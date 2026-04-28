import { Router, type IRouter, type Request, type Response } from "express";
import { db, customersTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, ilike, or, desc, sql, count, sum } from "drizzle-orm";

const router: IRouter = Router();

// JOIN condition: match orders to customers by email (case-insensitive) or phone
const ORDER_JOIN_ON = sql.raw(`
  ON o.status != 'cancelled'
  AND (
    (c.email != '' AND lower(o.customer_email) = lower(c.email))
    OR (c.phone != '' AND o.customer_phone = c.phone)
  )
`);

router.get("/customers/stats", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.execute<{ total_customers: string; total_orders: string; total_revenue: string }>(sql`
    SELECT
      (SELECT COUNT(*) FROM customers)::int                    AS total_customers,
      COALESCE(COUNT(o.id), 0)::int                           AS total_orders,
      COALESCE(SUM(o.total::numeric), 0)                      AS total_revenue
    FROM customers c
    LEFT JOIN orders o ${ORDER_JOIN_ON}
  `);
  const row = rows.rows?.[0];
  res.json({
    totalCustomers: Number(row?.total_customers ?? 0),
    totalOrders:    Number(row?.total_orders    ?? 0),
    totalRevenue:   parseFloat(String(row?.total_revenue ?? "0")),
  });
});

router.get("/customers", async (req: Request, res: Response): Promise<void> => {
  const q = ((req.query as Record<string, string>).q ?? "").trim();
  const limit  = Math.min(parseInt((req.query as Record<string, string>).limit  ?? "50",  10) || 50,  500);
  const offset = Math.max(parseInt((req.query as Record<string, string>).offset ?? "0",   10) || 0,   0);

  const searchWhere = q
    ? sql`AND (c.name ILIKE ${'%' + q + '%'} OR c.email ILIKE ${'%' + q + '%'} OR c.phone ILIKE ${'%' + q + '%'})`
    : sql``;

  const rows = await db.execute<{
    id: number; name: string; email: string | null; phone: string | null; notes: string | null;
    created_at: string; updated_at: string; order_count: number; total_spent: string;
  }>(sql`
    SELECT c.id, c.name, c.email, c.phone, c.notes, c.created_at, c.updated_at,
           COUNT(o.id)::int                   AS order_count,
           COALESCE(SUM(o.total::numeric), 0) AS total_spent
    FROM customers c
    LEFT JOIN orders o ${ORDER_JOIN_ON}
    WHERE true ${searchWhere}
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  res.json(rows.rows.map(c => ({
    id:         c.id,
    name:       c.name,
    email:      c.email,
    phone:      c.phone,
    notes:      c.notes,
    visitCount: Number(c.order_count  ?? 0),
    totalSpent: parseFloat(String(c.total_spent ?? "0")),
    createdAt:  c.created_at,
    updatedAt:  c.updated_at,
  })));
});

router.get("/customers/lookup", async (req: Request, res: Response): Promise<void> => {
  const email = ((req.query as Record<string, string>).email ?? "").trim().toLowerCase();
  const phone = ((req.query as Record<string, string>).phone ?? "").trim();

  if (!email && !phone) {
    res.status(400).json({ error: "email or phone required" });
    return;
  }

  let customer = null;
  if (email) {
    const rows = await db.select().from(customersTable)
      .where(sql`lower(${customersTable.email}) = ${email}`)
      .limit(1);
    customer = rows[0] ?? null;
  }
  if (!customer && phone) {
    const rows = await db.select().from(customersTable)
      .where(eq(customersTable.phone, phone))
      .limit(1);
    customer = rows[0] ?? null;
  }

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const orders = await db.select().from(ordersTable)
    .where(
      email
        ? sql`lower(${ordersTable.customerEmail}) = ${email}`
        : eq(ordersTable.customerPhone, phone)
    )
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  const ordersWithItems = await Promise.all(orders.map(async (o) => {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
    return {
      ...o,
      subtotal: parseFloat(o.subtotal),
      discountAmount: parseFloat(o.discountAmount ?? "0"),
      tax: parseFloat(o.tax),
      total: parseFloat(o.total),
      items: items.map(i => ({
        ...i,
        subtotal: parseFloat(i.subtotal),
        menuItemPrice: parseFloat(i.menuItemPrice),
      })),
    };
  }));

  res.json({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    visitCount: customer.visitCount,
    totalSpent: parseFloat(customer.totalSpent ?? "0"),
    createdAt: customer.createdAt,
    orders: ordersWithItems,
  });
});

router.get("/customers/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }

  const orders = await db.select().from(ordersTable)
    .where(
      customer.email
        ? sql`lower(${ordersTable.customerEmail}) = ${customer.email!.toLowerCase()}`
        : eq(ordersTable.customerPhone, customer.phone ?? "")
    )
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  const ordersWithItems = await Promise.all(orders.map(async (o) => {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
    return {
      ...o,
      subtotal: parseFloat(o.subtotal),
      discountAmount: parseFloat(o.discountAmount ?? "0"),
      tax: parseFloat(o.tax),
      total: parseFloat(o.total),
      items: items.map(i => ({
        ...i,
        subtotal: parseFloat(i.subtotal),
        menuItemPrice: parseFloat(i.menuItemPrice),
      })),
    };
  }));

  res.json({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
    visitCount: customer.visitCount,
    totalSpent: parseFloat(customer.totalSpent ?? "0"),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    orders: ordersWithItems,
  });
});

router.delete("/customers/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ ok: true });
});

router.patch("/customers/:id/notes", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { notes } = req.body as { notes?: string };
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(customersTable).set({ notes: notes ?? null, updatedAt: new Date() }).where(eq(customersTable.id, id));
  res.json({ ok: true });
});

export default router;

export async function upsertCustomer(name: string, email: string, phone: string, totalAmount: number): Promise<void> {
  if (!email && !phone) return;

  let existing = null;
  if (email) {
    const rows = await db.select().from(customersTable)
      .where(sql`lower(${customersTable.email}) = ${email.toLowerCase()}`)
      .limit(1);
    existing = rows[0] ?? null;
  }
  if (!existing && phone) {
    const rows = await db.select().from(customersTable)
      .where(eq(customersTable.phone, phone))
      .limit(1);
    existing = rows[0] ?? null;
  }

  if (existing) {
    await db.update(customersTable).set({
      name,
      email: email || existing.email,
      phone: phone || existing.phone,
      visitCount: (existing.visitCount ?? 0) + 1,
      totalSpent: String(parseFloat(existing.totalSpent ?? "0") + totalAmount),
      updatedAt: new Date(),
    }).where(eq(customersTable.id, existing.id));
  } else {
    await db.insert(customersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      visitCount: 1,
      totalSpent: String(totalAmount),
    });
  }
}
