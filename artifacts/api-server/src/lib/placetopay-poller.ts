import { eq, and, ne, isNotNull, gte } from "drizzle-orm";
import { db, ordersTable, paymentEventsTable } from "@workspace/db";
import { isConfigured, getSessionStatus } from "./placetopay.js";
import { notifyOrderPaid } from "../routes/orders";
import { logger } from "./logger";

async function logEvent(
  requestId: string,
  order: { id: number; confirmationCode: string | null },
  event: string,
  rawStatus: string,
  notes: string,
) {
  db.insert(paymentEventsTable)
    .values({
      requestId,
      orderId: order.id,
      orderRef: order.confirmationCode ?? undefined,
      event,
      rawStatus,
      sigPresent: false,
      notes,
    })
    .catch((err: unknown) => logger.error({ err }, "[PTP] failed to log payment event"));
}

const POLL_INTERVAL_MS      = 10_000;   // fast poller — every 10 s for fresh sessions
const MAX_AGE_MINUTES       = 35;       // Placetopay sessions expire after 30 min; give a little extra
const RECONCILE_INTERVAL_MS = 300_000;  // reconciler — every 5 min for any stuck orders

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
            logEvent(order.placetopayRequestId!, order, "APPROVED", status, "via-poller");
            notifyOrderPaid(order.id).catch(() => {});
            logger.info(`[PTP poller] order ${order.id} (${order.confirmationCode}) APPROVED — notifying POS`);
          } else if (status === "REJECTED" || status === "FAILED") {
            await db
              .update(ordersTable)
              .set({ status: "cancelled" })
              .where(eq(ordersTable.id, order.id));
            logEvent(order.placetopayRequestId!, order, status, status, "via-poller");
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

/**
 * Reconciliation cron job — runs every 5 minutes.
 *
 * Broader sweep than the fast poller: no age limit, catches any pending card
 * order that still has a Placetopay request ID regardless of when it was
 * created (server restarts, missed webhooks, etc.). This is the job
 * Placetopay requires for transaction reconciliation.
 */
export function startPlacetopayReconciler(): void {
  if (!isConfigured()) return;

  const reconcile = async () => {
    try {
      const pendingOrders = await db
        .select()
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.paymentStatus, "pending"),
            eq(ordersTable.paymentMethod, "card"),
            ne(ordersTable.status, "cancelled"),
            isNotNull(ordersTable.placetopayRequestId),
          )
        );

      if (pendingOrders.length === 0) return;

      logger.info(`[PTP reconciler] sweeping ${pendingOrders.length} pending card order(s)`);

      for (const order of pendingOrders) {
        if (!order.placetopayRequestId) continue;
        try {
          const status = await getSessionStatus(order.placetopayRequestId);
          if (status === "APPROVED") {
            await db
              .update(ordersTable)
              .set({ paymentStatus: "paid", status: "pending", paymentMethod: "card" })
              .where(eq(ordersTable.id, order.id));
            logEvent(order.placetopayRequestId!, order, "APPROVED", status, "via-reconciler");
            notifyOrderPaid(order.id).catch(() => {});
            logger.info(`[PTP reconciler] order ${order.id} APPROVED — marked paid`);
          } else if (status === "REJECTED" || status === "FAILED") {
            await db
              .update(ordersTable)
              .set({ status: "cancelled" })
              .where(eq(ordersTable.id, order.id));
            logEvent(order.placetopayRequestId!, order, status, status, "via-reconciler");
            logger.info(`[PTP reconciler] order ${order.id} cancelled after ${status}`);
          } else if (status === "REVERSED") {
            // PlaceToPay reversed the payment on their side (e.g. chargeback/void).
            // Mark as refunded in our DB and record a refund entry.
            const { db: dbRef, refundsTable } = await import("@workspace/db");
            await dbRef.insert(refundsTable).values({
              orderId:      order.id,
              amount:       order.total ?? "0",
              reason:       "Reversed by PlaceToPay",
              refundMethod: "card",
            }).onConflictDoNothing();
            await db
              .update(ordersTable)
              .set({ paymentStatus: "refunded" })
              .where(eq(ordersTable.id, order.id));
            logEvent(order.placetopayRequestId!, order, "REVERSED", status, "via-reconciler");
            logger.info(`[PTP reconciler] order ${order.id} REVERSED — marked refunded`);
          }
        } catch (err) {
          logger.error({ err }, `[PTP reconciler] status check failed for order ${order.id}`);
        }
      }
    } catch (err) {
      logger.error({ err }, "[PTP reconciler] reconcile cycle failed");
    }
  };

  // Run once immediately on startup, then every 5 minutes.
  reconcile().catch(() => {});
  setInterval(reconcile, RECONCILE_INTERVAL_MS);
  logger.info(`[PTP reconciler] started — sweeping all pending card orders every ${RECONCILE_INTERVAL_MS / 60_000} min`);
}
