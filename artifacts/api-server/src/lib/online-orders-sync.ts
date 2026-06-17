import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 5_000;
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Push a local status change back to the cloud so the customer tracking
 * page stays accurate. Fire-and-forget — errors are logged but never thrown.
 * Only does anything when SYNC_TARGET_URL + SYNC_SECRET are configured
 * (i.e. this is the local server, not the cloud itself).
 */
/**
 * Push settings changes to the cloud so the online ordering site stays accurate.
 * Fire-and-forget — only runs on the local server (SYNC_TARGET_URL set).
 */
export function pushSettingsToCloud(updates: Record<string, string>): void {
  const cloudUrl = process.env.SYNC_TARGET_URL?.replace(/\/$/, "");
  const syncSecret = process.env.SYNC_SECRET;
  if (!cloudUrl || !syncSecret) return;

  fetch(`${cloudUrl}/api/sync/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": syncSecret,
    },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => {
    logger.warn({ err }, "Settings push to cloud failed");
  });
}

export function pushSoldOutItemToCloud(itemId: number, available: boolean): void {
  const cloudUrl = process.env.SYNC_TARGET_URL?.replace(/\/$/, "");
  const syncSecret = process.env.SYNC_SECRET;
  if (!cloudUrl || !syncSecret) return;
  fetch(`${cloudUrl}/api/sync/soldout/item/${itemId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Sync-Secret": syncSecret },
    body: JSON.stringify({ available }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => logger.warn({ err }, "Sold-out item push to cloud failed"));
}

export function pushSoldOutModifierOptionToCloud(modifierId: number, optionId: string, available: boolean): void {
  const cloudUrl = process.env.SYNC_TARGET_URL?.replace(/\/$/, "");
  const syncSecret = process.env.SYNC_SECRET;
  if (!cloudUrl || !syncSecret) return;
  fetch(`${cloudUrl}/api/sync/soldout/modifier-option`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Sync-Secret": syncSecret },
    body: JSON.stringify({ modifierId, optionId, available }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => logger.warn({ err }, "Sold-out modifier push to cloud failed"));
}

export function pushStatusToCloud(
  confirmationCode: string,
  updates: {
    status?: string;
    kdsCleared?: boolean;
    estimatedReadyAt?: Date | null;
    cancellationReason?: string | null;
    paymentStatus?: string;
    amountTendered?: string | null;
  },
): void {
  const cloudUrl = process.env.SYNC_TARGET_URL?.replace(/\/$/, "");
  const syncSecret = process.env.SYNC_SECRET;
  if (!cloudUrl || !syncSecret) return; // running on cloud — skip

  const url = `${cloudUrl}/api/orders/sync-status`;
  fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${syncSecret}`,
    },
    body: JSON.stringify({ confirmationCode, ...updates }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => {
    logger.warn({ err, confirmationCode }, "Status write-back to cloud failed");
  });
}

export function startOnlineOrdersSync(): void {
  const cloudUrl = process.env.SYNC_TARGET_URL?.replace(/\/$/, "");
  const syncSecret = process.env.SYNC_SECRET;

  if (!cloudUrl || !syncSecret) {
    logger.info("Online orders sync disabled — SYNC_TARGET_URL or SYNC_SECRET not set");
    return;
  }

  logger.info({ cloudUrl }, "Online orders sync enabled — polling every 5s");

  // On startup pull the last 24 hours so we catch orders missed during longer outages.
  // The `existing` check below prevents duplicates — this is safe to be generous.
  let lastSyncTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  async function sync() {
    try {
      const url = `${cloudUrl}/api/orders/online-sync?since=${encodeURIComponent(lastSyncTime)}`;
      logger.debug({ url }, "Online sync: fetching");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${syncSecret}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "Online sync: cloud responded with error");
        return;
      }

      const payload = await res.json() as Array<{
        order: Record<string, unknown>;
        items: Array<Record<string, unknown>>;
      }>;

      let imported = 0;
      for (const { order, items } of payload) {
        const code = order.confirmationCode as string;

        // Check if order already exists locally
        const existing = await db
          .select({ id: ordersTable.id, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status })
          .from(ordersTable)
          .where(eq(ordersTable.confirmationCode, code))
          .limit(1);

        if (existing.length > 0) {
          // Order exists — sync mutable fields (payment status, order status) if cloud differs.
          // This is the critical path for PlaceToPay: the order arrives locally as paymentStatus=pending,
          // then the cloud poller marks it paid — without this update it would stay hidden from the POS.
          const local = existing[0];
          const cloudStatus        = (order.status        as string) ?? "pending";
          const cloudPaymentStatus = (order.paymentStatus as string) ?? "pending";
          if (local.paymentStatus !== cloudPaymentStatus || local.status !== cloudStatus) {
            await db
              .update(ordersTable)
              .set({
                paymentStatus: cloudPaymentStatus as "pending" | "paid" | "failed" | "refunded",
                status:        cloudStatus        as "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled",
              })
              .where(eq(ordersTable.confirmationCode, code));
            imported++; // count as a meaningful sync event
          }
          continue;
        }

        // Insert the order (new local serial ID is auto-assigned)
        const [inserted] = await db
          .insert(ordersTable)
          .values({
            confirmationCode:  code,
            customerName:      order.customerName      as string,
            customerEmail:     (order.customerEmail    as string) ?? "",
            customerPhone:     (order.customerPhone    as string) ?? "",
            orderType:         (order.orderType        as string) ?? "pickup",
            deliveryAddress:   (order.deliveryAddress  as string | null) ?? null,
            status:            (order.status           as string) ?? "pending",
            paymentStatus:     (order.paymentStatus    as string) ?? "pending",
            paymentMethod:     (order.paymentMethod    as string) ?? "card",
            source:            "online",
            subtotal:          order.subtotal          as string,
            discountAmount:    (order.discountAmount   as string) ?? "0",
            tax:               order.tax               as string,
            deliveryFee:       (order.deliveryFee      as string) ?? "0",
            total:             order.total             as string,
            notes:             (order.notes            as string | null) ?? null,
            createdAt:         new Date(order.createdAt as string),
          })
          .returning({ id: ordersTable.id });

        // Insert items using the new local order ID.
        // menuItemId is intentionally set to null — the cloud's item IDs won't
        // match the local DB's IDs, so using the cloud ID would violate the FK
        // constraint. Name and price are stored directly, so null is safe here.
        if (items.length > 0) {
          await db.insert(orderItemsTable).values(
            items.map((item) => ({
              orderId:            inserted.id,
              menuItemId:         null,
              menuItemName:       item.menuItemName  as string,
              menuItemPrice:      item.menuItemPrice as string,
              quantity:           item.quantity      as number,
              notes:              (item.notes        as string | null) ?? null,
              modifierSelections: (item.modifierSelections as {
                modifierId: string; optionId: string; name: string; price: number;
              }[] | null) ?? null,
              subtotal:           item.subtotal      as string,
            }))
          );
        }

        imported++;
      }

      if (imported > 0) {
        logger.info({ imported }, "Synced online orders from cloud");
      }

      // Subtract a 60-second buffer before advancing the cursor.
      // lastSyncTime is the mini PC's clock; order.createdAt is the cloud's clock.
      // If the mini PC clock is even slightly ahead, orders placed just before the
      // sync can land in the "past" relative to the new cursor and be permanently
      // missed. The 60-second overlap means we re-check the last minute every cycle;
      // duplicates are safely skipped by the existing `existing.length > 0` guard.
      lastSyncTime = new Date(Date.now() - 60_000).toISOString();
    } catch (err) {
      logger.error({ err }, "Online orders sync error");
    }
  }

  // Recursive loop — waits for each sync to finish before scheduling the next,
  // so a slow cloud response never causes overlapping requests.
  async function loop() {
    await sync();
    setTimeout(() => { void loop(); }, POLL_INTERVAL_MS);
  }
  void loop();
}
