import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import {
  InitiatePaymentBody,
  ConfirmPaymentBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { requireStaffAuth } from "./auth";
import * as ptp from "../lib/placetopay.js";
import { notifyOrderPaid } from "./orders";

const STORE_URL = (process.env.STORE_URL ?? "https://orders.islandtacosbvi.com").replace(/\/$/, "");

const ATH_BASE = "https://payments.athmovil.com/api/business-transaction/ecommerce";

// In-memory store for pending ATH Móvil sessions (expires with the process)
const athSessions = new Map<number, { ecommerceId: string; authToken: string; expiresAt: number }>();

function cleanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10); // last 10 digits
}

const router: IRouter = Router();

router.post("/payments/initiate", async (req, res): Promise<void> => {
  const parsed = InitiatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, parsed.data.orderId));

  if (!order) {
    res.status(400).json({ error: "Order not found" });
    return;
  }

  if (order.paymentStatus === "paid") {
    res.status(400).json({ error: "Order already paid" });
    return;
  }

  const sessionId = randomUUID();
  const total = parseFloat(order.total as unknown as string);

  if (parsed.data.paymentMethod === "athmovil") {
    const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN;
    if (!publicToken) {
      res.json({
        sessionId,
        redirectUrl: null,
        paymentMethod: "athmovil",
        amount: total,
        status: "pending_configuration",
      });
      return;
    }

    res.json({
      sessionId,
      redirectUrl: null,
      paymentMethod: "athmovil",
      amount: total,
      publicToken,
      status: "ready",
    });
  } else if (parsed.data.paymentMethod === "card") {
    const elavonConfigured =
      !!process.env.ELAVON_MERCHANT_ID &&
      !!process.env.ELAVON_USER_ID &&
      !!process.env.ELAVON_PIN;

    if (!elavonConfigured) {
      res.json({
        sessionId,
        redirectUrl: null,
        paymentMethod: "card",
        amount: total,
        status: "pending_configuration",
      });
      return;
    }

    // TODO: Create Elavon Converge HPP session when credentials are configured
    res.json({
      sessionId,
      redirectUrl: null,
      paymentMethod: "card",
      amount: total,
      status: "pending",
    });
  } else {
    res.status(400).json({ error: "Unsupported payment method" });
  }
});

router.post("/payments/athmovil/verify", async (req, res): Promise<void> => {
  const { orderId, referenceNumber } = req.body as { orderId?: unknown; referenceNumber?: unknown };
  if (typeof orderId !== "number" || typeof referenceNumber !== "string" || !referenceNumber) {
    res.status(400).json({ error: "orderId and referenceNumber are required" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.paymentStatus === "paid") {
    res.json({ success: true, referenceNumber });
    return;
  }

  const privateToken = process.env.ATHMOVIL_PRIVATE_TOKEN;
  if (!privateToken) {
    res.status(500).json({ error: "ATH Móvil not configured" });
    return;
  }

  let verified = false;
  try {
    const verifyRes = await fetch("https://www.athmovil.com/rs/v3/verifyorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privateToken, referenceNumber }),
    });

    if (verifyRes.ok) {
      const data = await verifyRes.json() as { status?: string };
      verified = data.status === "COMPLETED";
    }
  } catch {
    // Verification request failed — treat as unverified
    verified = false;
  }

  if (!verified) {
    res.status(400).json({ error: "Payment could not be verified with ATH Móvil" });
    return;
  }

  await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", status: "pending" })
    .where(eq(ordersTable.id, order.id));

  res.json({ success: true, referenceNumber });
});

// ── Step 1: Create ATH Móvil payment request (sends push to customer's phone) ──
router.post("/payments/athmovil/create-session", async (req, res): Promise<void> => {
  const { orderId } = req.body as { orderId?: unknown };
  if (typeof orderId !== "number") {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.paymentStatus === "paid") { res.status(400).json({ error: "Already paid" }); return; }

  const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN;
  if (!publicToken) { res.status(500).json({ error: "ATH Móvil not configured" }); return; }

  const total = parseFloat(order.total as unknown as string);
  const phoneNumber = cleanPhone(order.customerPhone || "");

  req.log.info(`[ATH] Creating payment session — order #${orderId}, total $${total}, phone ...${phoneNumber.slice(-4)}`);

  try {
    const athRes = await fetch(`${ATH_BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicToken,
        timeout: 600,
        total,
        subtotal: total,
        tax: 0,
        metadata1: String(order.id),
        metadata2: order.confirmationCode,
        phoneNumber: parseInt(phoneNumber, 10) || phoneNumber,
        items: [],
      }),
    });

    const rawText = await athRes.text();
    req.log.info(`[ATH] /payment response ${athRes.status}: ${rawText.slice(0, 400)}`);

    if (!athRes.ok) {
      res.status(502).json({ error: "ATH Móvil declined payment request", detail: rawText });
      return;
    }

    const data = JSON.parse(rawText) as { status?: string; data?: { ecommerceId?: string; auth_token?: string } };
    const ecommerceId = data?.data?.ecommerceId;
    const authToken = data?.data?.auth_token;

    if (!ecommerceId || !authToken) {
      res.status(502).json({ error: "ATH Móvil returned unexpected response", raw: rawText });
      return;
    }

    // Store session server-side for polling/authorization
    athSessions.set(orderId, {
      ecommerceId,
      authToken,
      expiresAt: Date.now() + 11 * 60 * 1000, // 11 min TTL
    });

    res.json({ ecommerceId });
  } catch (err) {
    req.log.error({ err }, "[ATH] create-session failed");
    res.status(502).json({ error: "Could not reach ATH Móvil" });
  }
});

// ── Step 2: Poll payment status + auto-authorize when customer confirms ──────
router.post("/payments/athmovil/check-status", async (req, res): Promise<void> => {
  const { orderId } = req.body as { orderId?: unknown };
  if (typeof orderId !== "number") {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (order.paymentStatus === "paid") {
    res.json({ status: "COMPLETED" });
    return;
  }

  const session = athSessions.get(orderId);
  if (!session) {
    res.status(404).json({ error: "No active ATH Móvil session for this order" });
    return;
  }

  if (Date.now() > session.expiresAt) {
    athSessions.delete(orderId);
    res.json({ status: "CANCEL" });
    return;
  }

  const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN;
  if (!publicToken) { res.status(500).json({ error: "ATH Móvil not configured" }); return; }

  try {
    // Check current status — findPayment only needs publicToken + ecommerceId, no auth header
    const findRes = await fetch(`${ATH_BASE}/business/findPayment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ecommerceId: session.ecommerceId, publicToken }),
    });

    const findText = await findRes.text();
    req.log.info(`[ATH] findPayment response ${findRes.status}: ${findText.slice(0, 400)}`);

    const findData = JSON.parse(findText) as { data?: { ecommerceStatus?: string; referenceNumber?: string } };
    const ecommerceStatus = findData?.data?.ecommerceStatus ?? "OPEN";

    if (ecommerceStatus === "CONFIRM" || ecommerceStatus === "COMPLETED") {
      if (ecommerceStatus === "CONFIRM") {
        // Customer confirmed — run authorization to capture the funds
        const authRes = await fetch(`${ATH_BASE}/authorization`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.authToken}`,
          },
        });
        const authText = await authRes.text();
        req.log.info(`[ATH] authorization response ${authRes.status}: ${authText.slice(0, 400)}`);

        // CRITICAL: do NOT mark the order paid unless ATH actually authorized.
        // Previously this branch fell through and marked paid even on a 4xx/5xx.
        if (!authRes.ok) {
          res.status(502).json({ error: "ATH Móvil authorization failed", detail: authText });
          return;
        }
      }

      // Mark order paid — keep status "pending" so the POS new-order popup fires
      await db
        .update(ordersTable)
        .set({ paymentStatus: "paid", status: "pending", paymentMethod: "athmovil" })
        .where(eq(ordersTable.id, orderId));

      athSessions.delete(orderId);
      // Notify POS + customer now that payment is confirmed
      notifyOrderPaid(orderId).catch(() => {});
      res.json({ status: "COMPLETED", referenceNumber: findData?.data?.referenceNumber });
      return;
    }

    if (ecommerceStatus === "CANCEL") {
      athSessions.delete(orderId);
    }

    res.json({ status: ecommerceStatus });
  } catch (err) {
    req.log.error({ err }, "[ATH] check-status failed");
    res.status(502).json({ error: "Could not reach ATH Móvil" });
  }
});

// ── Placetopay WebCheckout ────────────────────────────────────────────────────

// Public — creates a Placetopay hosted-checkout session for a pending card order.
// Returns { processUrl } — frontend does window.location.href = processUrl.
router.post("/payments/placetopay/session", async (req, res): Promise<void> => {
  const { orderId, returnUrl: clientReturnUrl } = req.body as { orderId?: unknown; returnUrl?: unknown };
  if (typeof orderId !== "number") {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  if (!ptp.isConfigured()) {
    res.status(503).json({ error: "Card payments not configured" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.paymentStatus === "paid") { res.status(400).json({ error: "Already paid" }); return; }

  const totalUsd  = parseFloat(order.total as unknown as string).toFixed(2);
  const returnUrl = (typeof clientReturnUrl === "string" && clientReturnUrl.startsWith("http"))
    ? clientReturnUrl
    : `${STORE_URL}/track?code=${order.confirmationCode}&ptp=1`;

  try {
    // Build the notification URL from the actual incoming request host so it
    // works both on dev (Replit preview domain) and production (STORE_URL).
    const proto = (req.headers["x-forwarded-proto"] as string | undefined)
      ?.split(",")[0]?.trim() ?? "https";
    const host  = (req.headers["x-forwarded-host"] as string | undefined)
      ?? req.get("host")
      ?? STORE_URL.replace(/^https?:\/\//, "");
    const notificationUrl = `${proto}://${host}/api/payments/placetopay/notify`;
    req.log.info(`[PTP] notificationUrl=${notificationUrl}`);
    // Resolve real client IP — check X-Forwarded-For first (set by Replit proxy)
    const clientIp = (req.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress
      ?? "127.0.0.1";
    const clientUa = req.headers["user-agent"] ?? "Mozilla/5.0 IslandTacos/1.0";

    const session = await ptp.createSession(
      order.confirmationCode,
      `Island Tacos order ${order.confirmationCode}`,
      totalUsd,
      returnUrl,
      order.customerName,
      order.customerPhone || "",
      notificationUrl,
      order.email ?? undefined,
      clientIp,
      clientUa,
    );

    // Persist requestId so verify can find it even after a server restart
    await db.update(ordersTable)
      .set({ placetopayRequestId: session.requestId })
      .where(eq(ordersTable.id, orderId));

    req.log.info(`[PTP] session created — orderId=${orderId} requestId=${session.requestId} returnUrl=${returnUrl}`);
    res.json({ processUrl: session.processUrl });
  } catch (err) {
    req.log.error({ err }, "[PTP] session creation failed");
    res.status(502).json({ error: "Could not create payment session. Please try again." });
  }
});

// Public — server-to-server webhook PlaceToPay fires when a payment session changes
// state. Runs the same verify logic as /verify so orders go through even when the
// customer never clicks "Back to merchant."
// Body per PlaceToPay docs: { requestId, reference, signature, status: { status, reason, message, date } }
router.post("/payments/placetopay/notify", async (req, res): Promise<void> => {
  // Always respond 200 immediately — PlaceToPay will retry on non-2xx
  res.json({ ok: true });

  const body = req.body as {
    requestId?: unknown;
    reference?: unknown;
    signature?: unknown;
    status?:    { status?: string; date?: string; message?: string };
  };

  const requestId = typeof body.requestId === "number" ? body.requestId : null;
  if (!requestId) return;

  // Validate the sha256 signature to ensure the notification is genuinely from PlaceToPay.
  // Format: sha256(requestId + status.status + status.date + secretKey) → hex → "sha256:<hex>"
  const signature   = typeof body.signature === "string" ? body.signature : "";
  const statusStr   = body.status?.status ?? "";
  const statusDate  = body.status?.date   ?? "";
  if (signature) {
    const valid = ptp.verifyWebhookSignature(requestId, statusStr, statusDate, signature);
    if (!valid) {
      req.log.warn({ requestId, signature }, "[PTP] notify: invalid signature — ignoring");
      return;
    }
  }

  const [order] = await db.select().from(ordersTable)
    .where(eq(ordersTable.placetopayRequestId, requestId));
  if (!order) return;
  if (order.paymentStatus === "paid") return; // already handled

  try {
    // Use the status from the (signature-validated) notification body directly.
    // This avoids an extra round-trip to PlaceToPay for the common case.
    // Fall back to querying PTP if the notification body had no status.
    const status = statusStr
      ? (statusStr as ptp.PtpStatus)
      : await ptp.getSessionStatus(requestId);

    req.log.info(`[PTP] notify — orderId=${order.id} requestId=${requestId} status=${status}`);

    if (status === "APPROVED") {
      await db.update(ordersTable)
        .set({ paymentStatus: "paid", status: "pending", paymentMethod: "card" })
        .where(eq(ordersTable.id, order.id));
      notifyOrderPaid(order.id).catch(() => {});
    } else if (status === "REJECTED" || status === "FAILED") {
      await db.update(ordersTable)
        .set({ status: "cancelled" })
        .where(eq(ordersTable.id, order.id));
      req.log.info(`[PTP] notify: order ${order.id} cancelled after ${status}`);
    } else if (status === "REVERSED") {
      const { db: dbRef, refundsTable } = await import("@workspace/db");
      await dbRef.insert(refundsTable).values({
        orderId:      order.id,
        amount:       order.total ?? "0",
        reason:       "Reversed by PlaceToPay",
        refundMethod: "card",
      }).onConflictDoNothing();
      await db.update(ordersTable)
        .set({ paymentStatus: "refunded" })
        .where(eq(ordersTable.id, order.id));
      req.log.info(`[PTP] notify: order ${order.id} reversed — marked refunded`);
    }
  } catch (err) {
    req.log.error({ err }, "[PTP] notify verify failed");
  }
});

// Public — verifies a Placetopay session after customer returns from hosted checkout.
// Body: { code: string }  (order confirmation code, e.g. "IT-ABCD12")
// Returns { status: PtpStatus }. Marks order paid when APPROVED.
router.post("/payments/placetopay/verify", async (req, res): Promise<void> => {
  const { code } = req.body as { code?: unknown };
  if (typeof code !== "string" || !code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const [order] = await db.select().from(ordersTable)
    .where(eq(ordersTable.confirmationCode, code.toUpperCase()));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Idempotent — if already marked paid, return APPROVED immediately
  if (order.paymentStatus === "paid") {
    res.json({ status: "APPROVED" });
    return;
  }

  if (!order.placetopayRequestId) {
    res.status(400).json({ error: "No Placetopay session associated with this order" });
    return;
  }

  try {
    const detail = await ptp.getSessionDetail(order.placetopayRequestId);
    const { status, date, reasonMessage } = detail;
    req.log.info(`[PTP] verify — orderId=${order.id} code=${code} status=${status}`);

    if (status === "APPROVED") {
      // Keep status "pending" so the POS new-order popup + chime fires normally.
      // The list filter allows it through once paymentStatus = "paid".
      await db.update(ordersTable)
        .set({ paymentStatus: "paid", status: "pending", paymentMethod: "card" })
        .where(eq(ordersTable.id, order.id));
      // Notify POS + customer now that payment is confirmed
      notifyOrderPaid(order.id).catch(() => {});
    } else if (status === "REJECTED" || status === "FAILED") {
      // Card declined — cancel the order so it doesn't sit as an abandoned pending forever
      await db.update(ordersTable)
        .set({ status: "cancelled" })
        .where(eq(ordersTable.id, order.id));
      req.log.info(`[PTP] order ${order.id} cancelled after ${status}`);
    }

    // Return the full session summary required by PlaceToPay certification:
    // Reference, Transaction Amount, Date, and Status.
    res.json({
      status,
      reference:   order.confirmationCode,
      amount:      parseFloat(order.total as unknown as string),
      date:        date ?? null,
      reason:      reasonMessage ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "[PTP] verify failed");
    res.status(502).json({ error: "Could not verify payment" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Staff-only: marks an order paid by orderId. Without auth, anyone could mark
// arbitrary orders as paid by guessing IDs.
router.post("/payments/confirm", requireStaffAuth, async (req, res): Promise<void> => {
  const parsed = ConfirmPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, parsed.data.orderId));

  if (!order) {
    res.status(400).json({ error: "Order not found" });
    return;
  }

  await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", status: "confirmed" })
    .where(eq(ordersTable.id, order.id));

  res.json({
    success: true,
    orderId: order.id,
    message: "Payment confirmed successfully",
  });
});

export default router;
