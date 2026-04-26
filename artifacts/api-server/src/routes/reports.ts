import { Router, type IRouter } from "express";
import { gte, lte, and, eq, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, refundsTable } from "@workspace/db";

const router: IRouter = Router();

function parseDecimal(v: unknown) { return parseFloat((v as string) ?? "0") || 0; }

// BVI is UTC-4 — shift now into BVI "local" coordinates, set midnight, shift back
function getBVIMidnight(): Date {
  const BVI_OFFSET_MS = 4 * 60 * 60 * 1000;
  const bviNow = new Date(Date.now() - BVI_OFFSET_MS);
  bviNow.setUTCHours(0, 0, 0, 0);
  return new Date(bviNow.getTime() + BVI_OFFSET_MS);
}

function getBVIEndOfDay(): Date {
  const BVI_OFFSET_MS = 4 * 60 * 60 * 1000;
  const bviNow = new Date(Date.now() - BVI_OFFSET_MS);
  bviNow.setUTCHours(23, 59, 59, 999);
  return new Date(bviNow.getTime() + BVI_OFFSET_MS);
}

router.get("/reports/sales", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  const fromDate = from ? new Date(from) : getBVIMidnight();
  const toDate = to ? new Date(to) : getBVIEndOfDay();

  const conditions = [
    gte(ordersTable.createdAt, fromDate),
    lte(ordersTable.createdAt, toDate),
  ];

  const [paidOrders, allOrders, refunds] = await Promise.all([
    db.select().from(ordersTable).where(and(...conditions, eq(ordersTable.paymentStatus, "paid"))),
    db.select().from(ordersTable).where(and(...conditions)),
    db.select().from(refundsTable).where(and(
      gte(refundsTable.createdAt, fromDate),
      lte(refundsTable.createdAt, toDate),
    )),
  ]);

  const byMethod = { cash: 0, card: 0, athmovil: 0, split: 0, complimentary: 0 };
  let totalSales = 0;
  for (const o of paidOrders) {
    const amt = parseDecimal(o.total);
    totalSales += amt;
    const m = (o.paymentMethod ?? "cash") as keyof typeof byMethod;
    if (m in byMethod) byMethod[m] += amt;
  }

  const refundTotal = refunds.reduce((s, r) => s + parseDecimal(r.amount), 0);

  // Top items
  const orderIds = paidOrders.map(o => o.id);
  let topItems: { name: string; quantity: number; revenue: number }[] = [];
  if (orderIds.length > 0) {
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(sql`${orderItemsTable.orderId} = ANY(${sql.raw(`ARRAY[${orderIds.join(",")}]::int[]`)})`);
    const itemMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const item of items) {
      const name = item.menuItemName;
      if (!itemMap[name]) itemMap[name] = { quantity: 0, revenue: 0 };
      itemMap[name].quantity += item.quantity;
      itemMap[name].revenue += parseDecimal(item.subtotal);
    }
    topItems = Object.entries(itemMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);
  }

  // Daily breakdown for charts
  const BVI_OFFSET_MS = 4 * 60 * 60 * 1000;
  const dailyMap: Record<string, { date: string; sales: number; orders: number }> = {};
  for (const o of paidOrders) {
    const bviDate = new Date(o.createdAt.getTime() - BVI_OFFSET_MS);
    const d = bviDate.toISOString().slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, orders: 0 };
    dailyMap[d].sales += parseDecimal(o.total);
    dailyMap[d].orders += 1;
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    totalOrders: allOrders.length,
    paidOrders: paidOrders.length,
    cancelledOrders: allOrders.filter(o => o.status === "cancelled").length,
    totalSales,
    byMethod,
    refundTotal,
    netSales: totalSales - refundTotal,
    avgOrderValue: paidOrders.length > 0 ? totalSales / paidOrders.length : 0,
    topItems,
    daily,
  });
});

export default router;
