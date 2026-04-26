import { Router, type IRouter } from "express";
import { gte, lte, and, eq, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, refundsTable, loyverseDailySummaryTable } from "@workspace/db";

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

/**
 * Parse a YYYY-MM-DD date string as the START of that day in BVI local time.
 * e.g. "2026-04-26" → 2026-04-26T04:00:00.000Z (midnight BVI = 4 AM UTC)
 */
function parseBVIDateStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, BVI_OFFSET_HOURS, 0, 0, 0));
}

/**
 * Parse a YYYY-MM-DD date string as the END of that day in BVI local time.
 * e.g. "2026-04-26" → 2026-04-27T03:59:59.999Z (11:59 PM BVI)
 */
function parseBVIDateEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, BVI_OFFSET_HOURS + 23, 59, 59, 999));
}

router.get("/reports/sales", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  const fromDate = from ? parseBVIDateStart(from) : getBVIMidnight();
  const toDate   = to   ? parseBVIDateEnd(to)     : getBVIEndOfDay();

  // from/to as plain YYYY-MM-DD strings for DATE column comparisons
  const fromDateStr = from ?? fromDate.toISOString().slice(0, 10);
  const toDateStr   = to   ?? toDate.toISOString().slice(0, 10);

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

  // ── Totals from individual orders ──────────────────────────────────────────
  const byMethod = { cash: 0, card: 0, athmovil: 0, split: 0, complimentary: 0 };
  let totalSales = 0;
  for (const o of paidOrders) {
    const amt = parseDecimal(o.total);
    totalSales += amt;
    const m = (o.paymentMethod ?? "cash") as keyof typeof byMethod;
    if (m in byMethod) byMethod[m] += amt;
  }

  let refundTotal = refunds.reduce((s, r) => s + parseDecimal(r.amount), 0);

  // ── Daily chart map (seeded from individual orders) ────────────────────────
  const dailyMap: Record<string, { date: string; sales: number; orders: number }> = {};
  for (const o of paidOrders) {
    const bviDate = new Date(o.createdAt.getTime() - BVI_OFFSET_MS);
    const d = bviDate.toISOString().slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, orders: 0 };
    dailyMap[d].sales += parseDecimal(o.total);
    dailyMap[d].orders += 1;
  }

  // ── Daily summaries (historical data uploaded via CSV) ─────────────────────
  // Pull rows in date range that are NOT already covered by any order in the
  // orders table (any source), preventing double-counting the recent period.
  let summaryGross   = 0;
  let summaryRefunds = 0;

  try {
    // Get dates in the orders table (BVI local date) that fall in range
    const coveredDatesResult = await db.execute<{ bvi_date: string }>(sql`
      SELECT DISTINCT (created_at - INTERVAL '4 hours')::date::text AS bvi_date
      FROM orders
      WHERE created_at >= ${fromDate.toISOString()}
        AND created_at <= ${toDate.toISOString()}
    `);
    const coveredDates = new Set((coveredDatesResult as unknown as { bvi_date: string }[]).map(r => r.bvi_date));

    const summaryRows = await db
      .select()
      .from(loyverseDailySummaryTable)
      .where(and(
        gte(loyverseDailySummaryTable.date, fromDateStr),
        lte(loyverseDailySummaryTable.date, toDateStr),
      ));

    for (const row of summaryRows) {
      const dateStr = row.date as string; // YYYY-MM-DD
      if (coveredDates.has(dateStr)) continue; // already accounted for by individual orders

      const gross   = parseDecimal(row.grossSales);
      const refund  = parseDecimal(row.refunds);
      summaryGross   += gross;
      summaryRefunds += refund;

      // Add to daily chart (mark as historical — no individual order count)
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, sales: 0, orders: 0 };
      dailyMap[dateStr].sales += gross;
      // orders count stays 0 for historical aggregate days (no receipt-level detail)
    }
  } catch {
    // Table may not exist yet in dev — silently skip
  }

  totalSales  += summaryGross;
  refundTotal += summaryRefunds;
  byMethod.cash += summaryGross; // historical: all attributed to cash (payment method unknown)

  // ── Top items (individual orders only — no item detail in daily summaries) ─
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

  res.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    totalOrders: allOrders.length,
    paidOrders: paidOrders.length,
    cancelledOrders: allOrders.filter(o => o.status === "cancelled").length,
    totalSales: Math.round(totalSales * 100) / 100,
    byMethod,
    refundTotal: Math.round(refundTotal * 100) / 100,
    netSales: Math.round((totalSales - refundTotal) * 100) / 100,
    avgOrderValue: paidOrders.length > 0 ? Math.round(totalSales / paidOrders.length * 100) / 100 : 0,
    topItems,
    daily,
  });
});

export default router;
