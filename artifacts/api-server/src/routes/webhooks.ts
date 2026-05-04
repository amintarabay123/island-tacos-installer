import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, like, ne, or, sql } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";

const router: IRouter = Router();

interface AthMovilWebhookPayload {
  transactionType?: string;
  status?: string;
  total?: number | string;
  referenceNumber?: string;
  ecommerceId?: string;
  message?: string;
  metadata1?: string;
  metadata2?: string;
  name?: string;
  phoneNumber?: number | string;
  businessName?: string;
  date?: string;
}

async function markOrderPaid(orderId: number, referenceNumber?: string): Promise<boolean> {
  const [updated] = await db
    .update(ordersTable)
    .set({
      paymentStatus: "paid",
      status: "confirmed",
      paymentMethod: "athmovil",
      ...(referenceNumber ? { notes: sql`COALESCE(${ordersTable.notes}, '') || ' ATH-REF:' || ${referenceNumber}` } : {}),
    })
    .where(eq(ordersTable.id, orderId))
    .returning();
  return !!updated;
}

/** Strip all non-digits and return the last 7 digits for local BVI matching */
function normalizePhone(raw: string | number | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "").slice(-7);
}

router.post("/webhooks/athmovil", async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as AthMovilWebhookPayload;

  console.log("[ATH webhook] Received event:", JSON.stringify(payload, null, 2));

  res.status(200).json({ received: true });

  const isCompleted = payload.status === "COMPLETED";
  const isTest = !payload.status ||
    payload.status.toLowerCase().includes("test") ||
    payload.status.toLowerCase().includes("simul");

  if (!isCompleted && !isTest) {
    console.log(`[ATH webhook] Skipping non-COMPLETED status: ${payload.status}`);
    return;
  }
  if (isTest) {
    console.log("[ATH webhook] Test/simulated event — webhook connected correctly!");
    return;
  }

  const refNum = payload.referenceNumber;

  try {
    // ── 1. Ecommerce button flow: orderId in metadata1 ────────────────────────
    if (payload.metadata1) {
      const orderId = parseInt(payload.metadata1, 10);
      if (!isNaN(orderId)) {
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
        if (order && order.paymentStatus !== "paid") {
          await markOrderPaid(orderId, refNum);
          console.log(`[ATH webhook] ✓ Order #${orderId} paid via metadata1`);
          return;
        }
      }
    }

    // ── 2. Pay a Business with confirmation code in message ───────────────────
    if (payload.message) {
      const codeMatch = payload.message.match(/\bIT[A-Z0-9]{6}\b/i);
      if (codeMatch) {
        const code = codeMatch[0].toUpperCase();
        const [order] = await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.confirmationCode, code));
        if (order && order.paymentStatus !== "paid") {
          await markOrderPaid(order.id, refNum);
          console.log(`[ATH webhook] ✓ Order ${code} paid via message code`);
          return;
        }
      }
    }

    // ── 3. Ecommerce flow: ecommerceId fallback ───────────────────────────────
    if (payload.ecommerceId) {
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(like(ordersTable.notes, `%${payload.ecommerceId}%`));
      if (order && order.paymentStatus !== "paid") {
        await markOrderPaid(order.id, refNum);
        console.log(`[ATH webhook] ✓ Order #${order.id} paid via ecommerceId`);
        return;
      }
    }

    // ── 4. Pay a Business: phone + amount match (last 48 h unpaid orders) ─────
    const rawTotal = typeof payload.total === "string"
      ? parseFloat(payload.total)
      : (payload.total ?? 0);
    const webhookPhone = normalizePhone(payload.phoneNumber);

    if (webhookPhone.length >= 7 && rawTotal > 0) {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const candidates = await db
        .select()
        .from(ordersTable)
        .where(
          and(
            ne(ordersTable.paymentStatus, "paid"),
            eq(ordersTable.paymentMethod, "athmovil"),
            gte(ordersTable.createdAt, cutoff),
          )
        );

      const phoneMatches = candidates.filter(o => {
        const orderPhone = normalizePhone(o.customerPhone);
        if (orderPhone.length < 7 || !orderPhone.endsWith(webhookPhone.slice(-7))) return false;
        const orderTotal = parseFloat(o.total as unknown as string);
        return Math.abs(orderTotal - rawTotal) < 0.01;
      });

      if (phoneMatches.length === 1) {
        await markOrderPaid(phoneMatches[0].id, refNum);
        console.log(`[ATH webhook] ✓ Order #${phoneMatches[0].id} paid via phone+amount match`);
        return;
      }
      if (phoneMatches.length > 1) {
        console.warn(`[ATH webhook] Ambiguous phone+amount match (${phoneMatches.length} orders) — not auto-marking`);
      }
    }

    // ── 5. No match — log it clearly ─────────────────────────────────────────
    console.warn(
      `[ATH webhook] UNMATCHED payment — $${rawTotal} from ${payload.name ?? "unknown"} ` +
      `(${payload.phoneNumber ?? "no phone"}) ref:${refNum ?? "none"}. ` +
      `This appears to be a general ATH Móvil payment not linked to an online order.`
    );
  } catch (err) {
    console.error("[ATH webhook] Error processing payment:", err);
  }
});

export default router;
