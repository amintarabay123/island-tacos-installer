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
export function pushStatusToCloud(
  confirmationCode: string,
  updates: {
    status?: string;
    kdsCleared?: boolean;
    estimatedReadyAt?: Date | null;
    cancellationReason?: string | null;
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

  // On startup pull the last 2 hours so we catch any orders placed while offline
  let lastSyncTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

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

        // Skip orders already in local DB
        const existing = await db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.confirmationCode, code))
          .limit(1);
        if (existing.length > 0) continue;

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

      lastSyncTime = new Date().toISOString();
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
