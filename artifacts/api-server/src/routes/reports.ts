import { Router, type IRouter } from "express";
import { gte, lte, and, eq, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, refundsTable, loyverseDailySummaryTable } from "@workspace/db";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function parseDecimal(v: unknown) { return parseFloat((v as string) ?? "0") || 0; }

const BVI_OFFSET_HOURS = 4; // BVI = UTC-4, no DST
const BVI_OFFSET_MS    = BVI_OFFSET_HOURS * 60 * 60 * 1000;

function getBVIMidnight(): Date {
  const bviNow = new Date(Date.now() - BVI_OFFSET_MS);
  bviNow.setUTCHours(0, 0, 0, 0);
  return new Date(bviNow.getTime() + BVI_OFFSET_MS);
}

function getBVIEndOfDay(): Date {
  const bviNow = new Date(Date.now() - BVI_OFFSET_MS);
  bviNow.setUTCHours(23, 59, 59, 999);
  return new Date(bviNow.getTime() + BVI_OFFSET_MS);
}

function parseBVIDateStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, BVI_OFFSET_HOURS, 0, 0, 0));
}

function parseBVIDateEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, BVI_OFFSET_HOURS + 23, 59, 59, 999));
}

router.get("/reports/sales", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  const fromDate = from ? parseBVIDateStart(from) : getBVIMidnight();
  const toDate   = to   ? parseBVIDateEnd(to)     : getBVIEndOfDay();

  // YYYY-MM-DD strings for DATE column comparisons
  const fromDateStr = from ?? fromDate.toISOString().slice(0, 10);
  const toDateStr   = to   ?? toDate.toISOString().slice(0, 10);

  const conditions = [
    gte(ordersTable.createdAt, fromDate),
    lte(ordersTable.createdAt, toDate),
  ];

  // ── Individual orders ──────────────────────────────────────────────────────
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
  let refundTotal = refunds.reduce((s, r) => s + parseDecimal(r.amount), 0);

  // Daily chart (seeded from individual orders)
  const dailyMap: Record<string, { date: string; sales: number; orders: number }> = {};
  for (const o of paidOrders) {
    const bviDate = new Date(o.createdAt.getTime() - BVI_OFFSET_MS);
    const d = bviDate.toISOString().slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, orders: 0 };
    dailyMap[d].sales += parseDecimal(o.total);
    dailyMap[d].orders += 1;
  }

  // ── Historical daily summaries (CSV import) ────────────────────────────────
  // Use raw pg pool so we get plain rows without any Drizzle wrapping surprises.
  // Only include days that have NO rows in the orders table for that BVI-local date
  // (avoids double-counting the recent period already stored as individual orders).
  try {
    const summaryResult = await pool.query<{
      date: string;
      gross_sales: string;
      refunds: string;
    }>(`
      SELECT date::text, gross_sales, refunds
      FROM loyverse_daily_summary
      WHERE date >= $1
        AND date <= $2
        AND date NOT IN (
          SELECT DISTINCT (created_at - INTERVAL '4 hours')::date
          FROM orders
          WHERE created_at >= $3
            AND created_at <= $4
        )
    `, [fromDateStr, toDateStr, fromDate.toISOString(), toDate.toISOString()]);

    for (const row of summaryResult.rows) {
      const gross  = parseDecimal(row.gross_sales);
      const refund = parseDecimal(row.refunds);
      totalSales  += gross;
      refundTotal += refund;
      byMethod.cash += gross; // payment method unknown for historical summaries

      if (!dailyMap[row.date]) dailyMap[row.date] = { date: row.date, sales: 0, orders: 0 };
      dailyMap[row.date].sales += gross;
    }
  } catch (err) {
    req.log.error({ err }, "[reports] Error fetching daily summaries");
    // Non-fatal — continue with individual orders only
  }

  // ── Top items (individual orders only — no item detail in summaries) ────────
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

  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  const roundedByMethod = Object.fromEntries(
    Object.entries(byMethod).map(([k, v]) => [k, Math.round(v * 100) / 100])
  ) as typeof byMethod;

  res.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    totalOrders: allOrders.length,
    paidOrders: paidOrders.length,
    cancelledOrders: allOrders.filter(o => o.status === "cancelled").length,
    totalSales: Math.round(totalSales * 100) / 100,
    byMethod: roundedByMethod,
    refundTotal: Math.round(refundTotal * 100) / 100,
    netSales: Math.round((totalSales - refundTotal) * 100) / 100,
    avgOrderValue: paidOrders.length > 0 ? Math.round(totalSales / paidOrders.length * 100) / 100 : 0,
    topItems,
    daily,
  });
});

export default router;
