import { db, ordersTable } from "@workspace/db";
import { eq, isNull, lt, gt, and, ne, isNotNull } from "drizzle-orm";
import { sendOrderReminderWhatsApp } from "./whatsapp";
import { logger } from "./logger";

const POLL_INTERVAL_MS   = 10 * 60 * 1000; // 10 minutes
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes — must be ready this long before reminding
const MAX_AGE_MS         = 48 * 60 * 60 * 1000; // 48 hours — don't remind on ancient orders

async function checkAndSendReminders(): Promise<void> {
  if (process.env.META_WHATSAPP_ENABLED !== "true") return;

  const minAge = new Date(Date.now() - STALE_THRESHOLD_MS); // ready > 60 min ago
  const maxAge = new Date(Date.now() - MAX_AGE_MS);         // ready < 48 h ago

  try {
    const staleOrders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "ready"),
          eq(ordersTable.paymentStatus, "pending"),
          isNotNull(ordersTable.customerPhone),
          ne(ordersTable.customerPhone, ""),
          isNull(ordersTable.waReminderSentAt),
          lt(ordersTable.updatedAt, minAge),  // ready for at least 60 min
          gt(ordersTable.updatedAt, maxAge),  // but not older than 48 h
        )
      );

    let sent = 0;
    for (const order of staleOrders) {
      logger.info({ orderId: order.id, code: order.confirmationCode }, "[reminders] sending pickup reminder");

      const ok = await sendOrderReminderWhatsApp(order).catch((err) => {
        logger.error({ err: err?.message, orderId: order.id }, "[reminders] WhatsApp send failed");
        return false;
      });

      if (ok) {
        // Only stamp after confirmed delivery — failed sends remain un-stamped for retry
        await db
          .update(ordersTable)
          .set({ waReminderSentAt: new Date() })
          .where(eq(ordersTable.id, order.id));
        sent++;
      } else {
        logger.warn({ orderId: order.id, code: order.confirmationCode },
          "[reminders] send failed — will retry next poll");
      }
    }

    if (sent > 0) {
      logger.info({ sent, checked: staleOrders.length }, "[reminders] pickup reminders sent");
    }
  } catch (err) {
    logger.error({ err }, "[reminders] check failed");
  }
}

export function startOrderReminderJob(): void {
  // Run once shortly after startup, then every 10 minutes
  setTimeout(() => {
    checkAndSendReminders();
    setInterval(checkAndSendReminders, POLL_INTERVAL_MS);
  }, 60_000); // wait 1 min after boot before first check

  logger.info("[reminders] pickup reminder job started (60min threshold, 10min poll)");
}
