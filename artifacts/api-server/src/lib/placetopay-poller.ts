import { eq, and, ne, isNotNull, gte } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { isConfigured, getSessionStatus } from "./placetopay.js";
import { notifyOrderPaid } from "../routes/orders";
import { logger } from "./logger";

const POLL_INTERVAL_MS  = 10_000;  // check every 10 s
const MAX_AGE_MINUTES   = 35;      // Placetopay sessions expire after 30 min; give a little extra

/**
 * Background job that polls Placetopay for any pending card orders that still
 * have an open session. This is the reliable path — it fires regardless of
 * whether the customer clicks "Back to merchant" and regardless of whether
 * Placetopay's webhook notification reaches us.
 *
 * Each cycle scans for: online card orders with paymentStatus=pending,
 * a placetopayRequestId, created within the last MAX_AGE_MINUTES minutes.
 * For each it calls getSessionStatus() and acts accordingly:
 *   APPROVED  → mark paid, broadcast to POS, send customer notifications
 *   REJECTED/FAILED → cancel the order
 *   PENDING   → do nothing, keep polling
 */
export function startPlacetopayPoller(): void {
  if (!isConfigured()) {
    logger.info("[PTP poller] Placetopay not configured — poller skipped");
    return;
  }

  const poll = async () => {
    try {
      const cutoff = new Date(Date.now() - MAX_AGE_MINUTES * 60 * 1000);

      const pendingOrders = await db
        .select()
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.paymentStatus, "pending"),
            eq(ordersTable.paymentMethod, "card"),
            ne(ordersTable.source, "pos"),
            ne(ordersTable.status, "cancelled"),
            isNotNull(ordersTable.placetopayRequestId),
            gte(ordersTable.createdAt, cutoff),
          )
        );

      if (pendingOrders.length === 0) return;

      logger.info(`[PTP poller] checking ${pendingOrders.length} pending card order(s)`);

      for (const order of pendingOrders) {
        if (!order.placetopayRequestId) continue;
        try {
          const status = await getSessionStatus(order.placetopayRequestId);
          if (status === "APPROVED") {
            await db
              .update(ordersTable)
              .set({ paymentStatus: "paid", status: "pending", paymentMethod: "card" })
              .where(eq(ordersTable.id, order.id));
            notifyOrderPaid(order.id).catch(() => {});
            logger.info(`[PTP poller] order ${order.id} (${order.confirmationCode}) APPROVED — notifying POS`);
          } else if (status === "REJECTED" || status === "FAILED") {
            await db
              .update(ordersTable)
              .set({ status: "cancelled" })
              .where(eq(ordersTable.id, order.id));
            logger.info(`[PTP poller] order ${order.id} cancelled after ${status}`);
          }
          // PENDING / UNKNOWN: keep polling until MAX_AGE_MINUTES expires
        } catch (err) {
          logger.error({ err }, `[PTP poller] status check failed for order ${order.id}`);
        }
      }
    } catch (err) {
      logger.error({ err }, "[PTP poller] poll cycle failed");
    }
  };

  setInterval(poll, POLL_INTERVAL_MS);
  logger.info(`[PTP poller] started — checking every ${POLL_INTERVAL_MS / 1000}s`);
}
