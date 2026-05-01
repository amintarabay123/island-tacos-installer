import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte, lt } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import {
  GetRecentOrdersQueryParams,
  GetAdminStatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const BVI_OFFSET_MS = 4 * 60 * 60 * 1000;

function getBVIMidnight(): Date {
  const bviNow = new Date(Date.now() - BVI_OFFSET_MS);
  bviNow.setUTCHours(0, 0, 0, 0);
  return new Date(bviNow.getTime() + BVI_OFFSET_MS);
}

function parseDateBVI(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const bviMidnight = new Date(
    Date.UTC(year, month - 1, day, 4, 0, 0, 0)
  );
  return bviMidnight;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  const queryParsed = GetAdminStatsQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const { startDate, endDate } = queryParsed.data;

  let rangeStart: Date;
  let rangeEnd: Date | null = null;

  if (startDate) {
    rangeStart = parseDateBVI(startDate);
    if (endDate) {
      const endDay = parseDateBVI(endDate);
      rangeEnd = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
    }
  } else {
    rangeStart = getBVIMidnight();
  }

  const conditions = [
    sql`${ordersTable.createdAt} >= ${rangeStart.toISOString()}`,
  ];
  if (rangeEnd) {
    conditions.push(sql`${ordersTable.createdAt} < ${rangeEnd.toISOString()}`);
  }

  const rangeOrders = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions));

  const todayRevenue = rangeOrders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + parseFloat(o.total as unknown as string), 0);

  const pendingOrders = rangeOrders.filter((o) =>
    ["pending", "confirmed", "preparing"].includes(o.status)
  ).length;

  const completedOrders = rangeOrders.filter(
    (o) => o.status === "completed"
  ).length;

  const allRangeItems = await db
    .select()
    .from(orderItemsTable)
    .where(
      sql`${orderItemsTable.orderId} IN (
        SELECT id FROM orders WHERE created_at >= ${rangeStart.toISOString()}
        ${rangeEnd ? sql`AND created_at < ${rangeEnd.toISOString()}` : sql``}
      )`
    );

  const itemCounts = new Map<string, number>();
  for (const item of allRangeItems) {
    const count = itemCounts.get(item.menuItemName) ?? 0;
    itemCounts.set(item.menuItemName, count + item.quantity);
  }

  const popularItems = Array.from(itemCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    todayOrders: rangeOrders.length,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    pendingOrders,
    completedOrders,
    popularItems,
  });
});

router.get("/admin/recent-orders", async (req, res): Promise<void> => {
  const queryParsed = GetRecentOrdersQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const { limit = 20, startDate, endDate } = queryParsed.data;

  const conditions = [];
  if (startDate) {
    const start = parseDateBVI(startDate);
    conditions.push(gte(ordersTable.createdAt, start));
  }
  if (endDate) {
    const endDay = parseDateBVI(endDate);
    const endBoundary = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
    conditions.push(lt(ordersTable.createdAt, endBoundary));
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));
      return {
        ...order,
        subtotal: parseFloat(order.subtotal as unknown as string),
        tax: parseFloat(order.tax as unknown as string),
        deliveryFee: parseFloat(order.deliveryFee as unknown as string),
        total: parseFloat(order.total as unknown as string),
        items: items.map((i) => ({
          ...i,
          menuItemPrice: parseFloat(i.menuItemPrice as unknown as string),
          subtotal: parseFloat(i.subtotal as unknown as string),
        })),
      };
    })
  );

  res.json(result);
});

export default router;
