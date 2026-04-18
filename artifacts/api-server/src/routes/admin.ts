import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { GetRecentOrdersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = await db
    .select()
    .from(ordersTable)
    .where(sql`${ordersTable.createdAt} >= ${today.toISOString()}`);

  const todayRevenue = todayOrders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + parseFloat(o.total as unknown as string), 0);

  const pendingOrders = todayOrders.filter((o) =>
    ["pending", "confirmed", "preparing"].includes(o.status)
  ).length;

  const completedOrders = todayOrders.filter(
    (o) => o.status === "completed"
  ).length;

  // Top items today
  const allTodayItems = await db
    .select()
    .from(orderItemsTable)
    .where(
      sql`${orderItemsTable.orderId} IN (
        SELECT id FROM orders WHERE created_at >= ${today.toISOString()}
      )`
    );

  const itemCounts = new Map<string, number>();
  for (const item of allTodayItems) {
    const count = itemCounts.get(item.menuItemName) ?? 0;
    itemCounts.set(item.menuItemName, count + item.quantity);
  }

  const popularItems = Array.from(itemCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    todayOrders: todayOrders.length,
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
  const limit = queryParsed.data.limit ?? 20;
  const orders = await db
    .select()
    .from(ordersTable)
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
