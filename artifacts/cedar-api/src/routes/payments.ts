import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import {
  InitiatePaymentBody,
  ConfirmPaymentBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { requireStaffAuth } from "./auth";

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
