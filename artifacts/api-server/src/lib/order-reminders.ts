import { db, ordersTable } from "@workspace/db";
import { eq, isNull, lt, and, ne } from "drizzle-orm";
import { sendOrderReminderWhatsApp } from "./whatsapp";
import { logger } from "./logger";

const POLL_INTERVAL_MS  = 10 * 60 * 1000; // 10 minutes
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

async function checkAndSendReminders(): Promise<void> {
  if (process.env.META_WHATSAPP_ENABLED !== "true") return;

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  try {
    const staleOrders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "ready"),
          eq(ordersTable.paymentStatus, "pending"),
          ne(ordersTable.customerPhone, ""),
          isNull(ordersTable.waReminderSentAt),
          lt(ordersTable.updatedAt, cutoff),
        )
      );

    for (const order of staleOrders) {
      logger.info({ orderId: order.id, code: order.confirmationCode }, "[reminders] sending pickup reminder");

      await sendOrderReminderWhatsApp(order).catch((err) =>
        logger.error({ err: err?.message, orderId: order.id }, "[reminders] WhatsApp send failed")
      );

      await db
        .update(ordersTable)
        .set({ waReminderSentAt: new Date() })
        .where(eq(ordersTable.id, order.id));
    }

    if (staleOrders.length > 0) {
      logger.info({ count: staleOrders.length }, "[reminders] pickup reminders sent");
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
