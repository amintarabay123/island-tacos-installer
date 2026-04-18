import { Router, type IRouter, type Request, type Response } from "express";
import { eq, like, or } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";

const router: IRouter = Router();

interface AthMovilWebhookPayload {
  transactionType?: string;
  status?: string;
  total?: number;
  referenceNumber?: string;
  ecommerceId?: string;
  message?: string;
  metadata1?: string;
  metadata2?: string;
  name?: string;
  phoneNumber?: number;
  businessName?: string;
  date?: string;
}

async function markOrderPaid(orderId: number): Promise<boolean> {
  const [updated] = await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", status: "confirmed", paymentMethod: "athmovil" })
    .where(eq(ordersTable.id, orderId))
    .returning();
  return !!updated;
}

router.post("/webhooks/athmovil", async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as AthMovilWebhookPayload;

  res.status(200).json({ received: true });

  if (payload.status !== "COMPLETED") return;

  try {
    // 1. Try matching by orderId in metadata1 (ecommerce button flow)
    if (payload.metadata1) {
      const orderId = parseInt(payload.metadata1, 10);
      if (!isNaN(orderId)) {
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
        if (order && order.paymentStatus !== "paid") {
          await markOrderPaid(orderId);
          console.log(`[ATH webhook] Marked order #${orderId} paid via metadata1`);
          return;
        }
      }
    }

    // 2. Try matching by confirmation code in message field (Pay a Business flow)
    if (payload.message) {
      const codeMatch = payload.message.match(/\bIT[A-Z0-9]{6}\b/i);
      if (codeMatch) {
        const code = codeMatch[0].toUpperCase();
        const [order] = await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.confirmationCode, code));
        if (order && order.paymentStatus !== "paid") {
          await markOrderPaid(order.id);
          console.log(`[ATH webhook] Marked order ${code} paid via message code`);
          return;
        }
      }
    }

    // 3. Try matching by referenceNumber in metadata2
    if (payload.ecommerceId) {
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(
          or(
            like(ordersTable.notes, `%${payload.ecommerceId}%`),
          )
        );
      if (order && order.paymentStatus !== "paid") {
        await markOrderPaid(order.id);
        console.log(`[ATH webhook] Marked order #${order.id} paid via ecommerceId`);
        return;
      }
    }

    console.warn(`[ATH webhook] Could not match payment to order:`, JSON.stringify(payload));
  } catch (err) {
    console.error("[ATH webhook] Error processing payment:", err);
  }
});

export default router;
