import { Router, type IRouter } from "express";
import { eq, isNull, desc, gte, lte, and, sql } from "drizzle-orm";
import { db, shiftsTable, cashTransactionsTable, ordersTable, refundsTable } from "@workspace/db";

const router: IRouter = Router();

function parseDecimal(v: unknown) { return parseFloat((v as string) ?? "0") || 0; }

router.get("/shifts/current", async (_req, res): Promise<void> => {
  const [shift] = await db
    .select()
    .from(shiftsTable)
    .where(isNull(shiftsTable.closedAt))
    .orderBy(desc(shiftsTable.openedAt))
    .limit(1);
  res.json(shift ?? null);
});

router.get("/shifts", async (_req, res): Promise<void> => {
  const shifts = await db.select().from(shiftsTable).orderBy(desc(shiftsTable.openedAt)).limit(50);
  res.json(shifts.map(s => ({
    ...s,
    openingFloat: parseDecimal(s.openingFloat),
    closingFloat: s.closingFloat ? parseDecimal(s.closingFloat) : null,
  })));
});

router.post("/shifts", async (req, res): Promise<void> => {
  const { openingFloat = 0, notes } = req.body as { openingFloat?: number; notes?: string };
  const existing = await db
    .select()
    .from(shiftsTable)
    .where(isNull(shiftsTable.closedAt))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "A shift is already open" });
    return;
  }
  const [shift] = await db.insert(shiftsTable).values({
    openingFloat: String(openingFloat),
    notes: notes ?? null,
  }).returning();
  await db.insert(cashTransactionsTable).values({
    shiftId: shift.id,
    type: "opening",
    amount: String(openingFloat),
    note: "Opening float",
  });
  res.status(201).json({ ...shift, openingFloat: parseDecimal(shift.openingFloat) });
});

router.patch("/shifts/:id/close", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { closingFloat, notes } = req.body as { closingFloat?: number; notes?: string };
  const [shift] = await db
    .update(shiftsTable)
    .set({ closedAt: new Date(), closingFloat: closingFloat != null ? String(closingFloat) : null, notes: notes ?? null })
    .where(eq(shiftsTable.id, id))
    .returning();
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  res.json({ ...shift, openingFloat: parseDecimal(shift.openingFloat), closingFloat: shift.closingFloat ? parseDecimal(shift.closingFloat) : null });
});

router.get("/shifts/:id/summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }

  const from = shift.openedAt;
  const to = shift.closedAt ?? new Date();

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(
      gte(ordersTable.createdAt, from),
      lte(ordersTable.createdAt, to),
      eq(ordersTable.paymentStatus, "paid"),
    ));

  const refunds = await db
    .select()
    .from(refundsTable)
    .where(and(gte(refundsTable.createdAt, from), lte(refundsTable.createdAt, to)));

  const cashTxns = await db
    .select()
    .from(cashTransactionsTable)
    .where(eq(cashTransactionsTable.shiftId, id));

  const byMethod = { cash: 0, card: 0, athmovil: 0 };
  let totalSales = 0;
  for (const o of orders) {
    const amt = parseDecimal(o.total);
    totalSales += amt;
    const m = (o.paymentMethod ?? "cash") as keyof typeof byMethod;
    if (m in byMethod) byMethod[m] += amt;
  }

  const refundTotal = refunds.reduce((s, r) => s + parseDecimal(r.amount), 0);
  const payIns = cashTxns.filter(t => t.type === "pay_in").reduce((s, t) => s + parseDecimal(t.amount), 0);
  const payOuts = cashTxns.filter(t => t.type === "pay_out").reduce((s, t) => s + parseDecimal(t.amount), 0);
  const openingFloat = parseDecimal(shift.openingFloat);
  const expectedCash = openingFloat + byMethod.cash + payIns - payOuts - refunds.filter(r => r.refundMethod === "cash").reduce((s, r) => s + parseDecimal(r.amount), 0);

  res.json({
    shift: { ...shift, openingFloat, closingFloat: shift.closingFloat ? parseDecimal(shift.closingFloat) : null },
    totalOrders: orders.length,
    totalSales,
    byMethod,
    refundTotal,
    netSales: totalSales - refundTotal,
    payIns,
    payOuts,
    expectedCash,
    cashTransactions: cashTxns.map(t => ({ ...t, amount: parseDecimal(t.amount) })),
  });
});

router.get("/cash-transactions", async (req, res): Promise<void> => {
  const shiftId = req.query.shiftId ? parseInt(req.query.shiftId as string) : null;
  let query = db.select().from(cashTransactionsTable).orderBy(desc(cashTransactionsTable.createdAt)).$dynamic();
  if (shiftId) query = query.where(eq(cashTransactionsTable.shiftId, shiftId));
  const txns = await query.limit(200);
  res.json(txns.map(t => ({ ...t, amount: parseDecimal(t.amount) })));
});

router.post("/cash-transactions", async (req, res): Promise<void> => {
  const { shiftId, type, amount, note } = req.body as { shiftId?: number; type: string; amount: number; note?: string };
  if (!["pay_in", "pay_out"].includes(type)) {
    res.status(400).json({ error: "type must be pay_in or pay_out" });
    return;
  }
  const [txn] = await db.insert(cashTransactionsTable).values({
    shiftId: shiftId ?? null,
    type,
    amount: String(amount),
    note: note ?? null,
  }).returning();
  res.status(201).json({ ...txn, amount: parseDecimal(txn.amount) });
});

export default router;
