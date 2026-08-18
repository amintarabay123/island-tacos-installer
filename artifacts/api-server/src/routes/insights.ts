import { Router, type IRouter } from "express";
import { gte, and, eq } from "drizzle-orm";
import OpenAI from "openai";
import { desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, customersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdminAuth } from "./auth";

const router: IRouter = Router();

const BVI_OFFSET_HOURS = 4; // BVI = UTC-4, no DST

function num(v: unknown): number { return parseFloat((v as string) ?? "0") || 0; }
function r2(v: number): number { return Math.round(v * 100) / 100; }

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Aggregate the last N days of business data into a compact stats object. */
async function buildStats(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await db.select().from(ordersTable).where(and(gte(ordersTable.createdAt, since)));
  const items = (await db.select({ item: orderItemsTable })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(gte(ordersTable.createdAt, since))).map(r => r.item);

  const paid = orders.filter(o => o.paymentStatus === "paid");
  const cancelled = orders.filter(o => o.status === "cancelled");

  // Revenue by day / weekday / hour (BVI local time)
  const byDay: Record<string, { revenue: number; orders: number }> = {};
  const byWeekday: Record<string, { revenue: number; orders: number }> = {};
  const byHour: Record<number, { revenue: number; orders: number }> = {};
  for (const o of paid) {
    const local = new Date(o.createdAt.getTime() - BVI_OFFSET_HOURS * 3600_000);
    const day = local.toISOString().slice(0, 10);
    const wd = WEEKDAYS[local.getUTCDay()];
    const hr = local.getUTCHours();
    (byDay[day] ??= { revenue: 0, orders: 0 });
    byDay[day].revenue = r2(byDay[day].revenue + num(o.total)); byDay[day].orders++;
    (byWeekday[wd] ??= { revenue: 0, orders: 0 });
    byWeekday[wd].revenue = r2(byWeekday[wd].revenue + num(o.total)); byWeekday[wd].orders++;
    (byHour[hr] ??= { revenue: 0, orders: 0 });
    byHour[hr].revenue = r2(byHour[hr].revenue + num(o.total)); byHour[hr].orders++;
  }

  // Item + modifier popularity (paid orders only)
  const paidIds = new Set(paid.map(o => o.id));
  const itemAgg: Record<string, { qty: number; revenue: number }> = {};
  const modAgg: Record<string, number> = {};
  for (const it of items) {
    if (!paidIds.has(it.orderId)) continue;
    (itemAgg[it.menuItemName] ??= { qty: 0, revenue: 0 });
    itemAgg[it.menuItemName].qty += it.quantity;
    itemAgg[it.menuItemName].revenue = r2(itemAgg[it.menuItemName].revenue + num(it.subtotal));
    for (const m of it.modifierSelections ?? []) {
      modAgg[m.name] = (modAgg[m.name] ?? 0) + it.quantity;
    }
  }
  const topItems = Object.entries(itemAgg).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 20)
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }));
  const bottomItems = Object.entries(itemAgg).sort((a, b) => a[1].qty - b[1].qty).slice(0, 10)
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }));
  const topModifiers = Object.entries(modAgg).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  // Sources & payment methods
  const bySource: Record<string, { orders: number; revenue: number }> = {};
  const byMethod: Record<string, { orders: number; revenue: number }> = {};
  for (const o of paid) {
    (bySource[o.source] ??= { orders: 0, revenue: 0 });
    bySource[o.source].orders++; bySource[o.source].revenue = r2(bySource[o.source].revenue + num(o.total));
    (byMethod[o.paymentMethod] ??= { orders: 0, revenue: 0 });
    byMethod[o.paymentMethod].orders++; byMethod[o.paymentMethod].revenue = r2(byMethod[o.paymentMethod].revenue + num(o.total));
  }

  // Customer behavior — repeat rate by phone (paid orders with a phone number)
  const byPhone: Record<string, { orders: number; spent: number; name: string }> = {};
  for (const o of paid) {
    const ph = (o.customerPhone ?? "").trim();
    if (!ph) continue;
    (byPhone[ph] ??= { orders: 0, spent: 0, name: o.customerName });
    byPhone[ph].orders++; byPhone[ph].spent = r2(byPhone[ph].spent + num(o.total));
  }
  const phones = Object.values(byPhone);
  const repeatCustomers = phones.filter(p => p.orders > 1);
  // Anonymized — no names/phones leave the server; AI only needs the shape of the data
  const topCustomers = phones.sort((a, b) => b.spent - a.spent).slice(0, 10)
    .map((p, i) => ({ rank: i + 1, orders: p.orders, spent: p.spent }));

  // Long-term loyalty from customers table (all-time, top 10 in DB — anonymized)
  const loyalRows = await db.select({ visitCount: customersTable.visitCount, totalSpent: customersTable.totalSpent })
    .from(customersTable).orderBy(desc(customersTable.totalSpent)).limit(10);
  const loyal = loyalRows.map((c, i) => ({ rank: i + 1, visits: c.visitCount, totalSpent: num(c.totalSpent) }));

  const totalRevenue = r2(paid.reduce((s, o) => s + num(o.total), 0));
  const totalDiscounts = r2(paid.reduce((s, o) => s + num(o.discountAmount), 0));

  return {
    periodDays: days,
    totals: {
      revenue: totalRevenue,
      paidOrders: paid.length,
      allOrders: orders.length,
      cancelledOrders: cancelled.length,
      cancellationRatePct: orders.length ? r2((cancelled.length / orders.length) * 100) : 0,
      avgTicket: paid.length ? r2(totalRevenue / paid.length) : 0,
      totalDiscounts,
    },
    revenueByDay: byDay,
    revenueByWeekday: byWeekday,
    revenueByHour: byHour,
    topItems,
    slowestItems: bottomItems,
    topModifiers,
    bySource,
    byPaymentMethod: byMethod,
    customers: {
      uniqueWithPhone: phones.length,
      repeatCount: repeatCustomers.length,
      repeatRatePct: phones.length ? r2((repeatCustomers.length / phones.length) * 100) : 0,
      topSpendersThisPeriod: topCustomers,
      allTimeTopCustomers: loyal,
    },
  };
}

const SYSTEM_PROMPT = `You are a sharp, practical restaurant business consultant analyzing sales data for Island Tacos, a taco shop in the British Virgin Islands (BVI, USD currency). You are speaking directly to the owner, who is not technical.

You will receive aggregated order/sales/customer statistics as JSON. Analyze it and reply in clean Markdown with EXACTLY these sections:

## 📊 What Your Numbers Say
3-6 short bullet points with the most important facts (revenue trend, busiest days/hours, best sellers, repeat-customer rate). Use concrete numbers from the data.

## ⭐ What's Working
2-4 bullets on strengths to protect.

## ⚠️ What Needs Attention
2-4 bullets on weak spots (slow items, dead hours, cancellation rate, low repeat rate, discount leakage — whatever the data actually shows).

## 💡 Suggestions to Streamline Operations
4-7 numbered, specific, actionable suggestions ranked by likely impact. Each one must be grounded in the data (cite the number that motivates it) and realistic for a small taco shop: staffing by hour/day, prep planning for top sellers, menu trimming or bundling, promoting slow hours, loyalty ideas for repeat customers, etc.

Rules: Never invent data not present in the JSON. If the data window is small or sparse, say so honestly and keep suggestions proportionate. Keep the whole reply under 600 words. No generic filler advice.`;

// POST /admin/ai-insights  { days?: number }
// Explicitly admin-gated here (in addition to the central /admin middleware) so
// this route can never be reached unauthenticated regardless of mount order.
router.post("/admin/ai-insights", requireAdminAuth, async (req, res): Promise<void> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured on this server." });
    return;
  }
  const days = Math.min(Math.max(parseInt(String(req.body?.days ?? "30"), 10) || 30, 7), 90);

  try {
    const stats = await buildStats(days);
    if (stats.totals.allOrders === 0) {
      res.status(422).json({ error: `No orders found in the last ${days} days — nothing to analyze yet.` });
      return;
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1400,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Here is the aggregated data for the last ${days} days:\n\n${JSON.stringify(stats)}` },
      ],
    });

    const analysis = completion.choices[0]?.message?.content?.trim();
    if (!analysis) {
      res.status(502).json({ error: "AI returned an empty response — try again." });
      return;
    }

    res.json({ generatedAt: new Date().toISOString(), periodDays: days, stats, analysis });
  } catch (err) {
    logger.error({ err }, "[ai-insights] failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "AI analysis failed" });
  }
});

export default router;
