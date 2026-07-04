import { db, ordersTable, orderItemsTable, paymentEventsTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
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
          // Order exists — sync ONLY paymentStatus from cloud → local.
          //
          // This is the critical path for PlaceToPay: the order arrives locally as
          // paymentStatus=pending, then the cloud poller marks it paid — without this
          // update it would stay hidden from the POS.
          //
          // Order STATUS is deliberately NOT synced cloud → local. The mini PC is the
          // source of truth for order status (staff accept/prepare/ready/complete all
          // happen here, and flow UP to the cloud via pushStatusToCloud). Pulling cloud
          // status back down would revert a locally-accepted order to "pending" whenever
          // the fire-and-forget write-back to cloud lost the race or failed — making the
          // order silently vanish from the KDS (KDS hides "pending"). That was the
          // intermittent "accepted order not reaching the KDS" bug.
          const local = existing[0];
          const cloudPaymentStatus = (order.paymentStatus as string) ?? "pending";
          if (local.paymentStatus !== cloudPaymentStatus) {
            await db
              .update(ordersTable)
              .set({
                paymentStatus: cloudPaymentStatus as "pending" | "paid" | "failed" | "refunded",
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

  // Payment events are created only in the cloud (PlaceToPay's webhook can't reach
  // the mini PC's LAN). Pull them down so the LOCAL admin's payment-events log
  // mirrors the cloud. Kept on its own cursor so it can't stall order sync.
  let lastPaymentEventSync = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  async function syncPaymentEvents() {
    try {
      const url = `${cloudUrl}/api/orders/payment-events-sync?since=${encodeURIComponent(lastPaymentEventSync)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${syncSecret}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, "Payment-events sync: cloud responded with error");
        return;
      }

      const events = await res.json() as Array<{
        requestId:  number | null;
        orderRef:   string | null;
        event:      string;
        rawStatus:  string | null;
        sigPresent: boolean;
        sigValid:   boolean | null;
        notes:      string | null;
        createdAt:  string;
      }>;

      if (events.length > 0) {
        // payment_events has no natural unique key, so dedup on
        // (orderRef, event, rawStatus, createdAt-ms). Load the events already
        // stored in the incoming window once, then skip anything we already have.
        const windowStart = new Date(Math.min(...events.map((e) => new Date(e.createdAt).getTime())));
        const existing = await db
          .select({
            orderRef:  paymentEventsTable.orderRef,
            event:     paymentEventsTable.event,
            rawStatus: paymentEventsTable.rawStatus,
            createdAt: paymentEventsTable.createdAt,
          })
          .from(paymentEventsTable)
          .where(gte(paymentEventsTable.createdAt, windowStart));

        const keyOf = (o: { orderRef: string | null; event: string; rawStatus: string | null; createdAt: Date | string }) =>
          `${o.orderRef ?? ""}|${o.event}|${o.rawStatus ?? ""}|${new Date(o.createdAt).getTime()}`;
        const seen = new Set(existing.map(keyOf));

        let imported = 0;
        for (const ev of events) {
          const createdAt = new Date(ev.createdAt);
          const key = keyOf({ ...ev, createdAt });
          if (seen.has(key)) continue;

          // Re-resolve the local order id from the confirmation code (numeric ids
          // differ between DBs). The event still imports if the order isn't local
          // yet — order_ref alone drives the admin log, so order_id stays null.
          let localOrderId: number | null = null;
          if (ev.orderRef) {
            const [ord] = await db
              .select({ id: ordersTable.id })
              .from(ordersTable)
              .where(eq(ordersTable.confirmationCode, ev.orderRef))
              .limit(1);
            localOrderId = ord?.id ?? null;
          }

          await db.insert(paymentEventsTable).values({
            requestId:  ev.requestId ?? null,
            orderId:    localOrderId,
            orderRef:   ev.orderRef ?? null,
            event:      ev.event,
            rawStatus:  ev.rawStatus ?? null,
            sigPresent: ev.sigPresent,
            sigValid:   ev.sigValid ?? null,
            notes:      ev.notes ?? null,
            createdAt,
          });
          seen.add(key);
          imported++;
        }

        if (imported > 0) {
          logger.info({ imported }, "Synced payment events from cloud");
        }
      }

      // 60-second overlap for clock skew; duplicates are dropped by the dedup set.
      lastPaymentEventSync = new Date(Date.now() - 60_000).toISOString();
    } catch (err) {
      logger.error({ err }, "Payment events sync error");
    }
  }

  // Recursive loop — waits for each sync to finish before scheduling the next,
  // so a slow cloud response never causes overlapping requests.
  async function loop() {
    await sync();
    await syncPaymentEvents();
    setTimeout(() => { void loop(); }, POLL_INTERVAL_MS);
  }
  void loop();
}
