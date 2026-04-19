import { Router, type IRouter } from "express";
import { eq, desc, and, inArray, count, or } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, refundsTable } from "@workspace/db";
import { upsertCustomer } from "./customers";
import {
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  TrackOrderParams,
  ListOrdersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TAX_RATE = 0;

function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "IT";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function parseDecimal(val: unknown): number {
  return parseFloat(val as string);
}

function formatOrder(order: Record<string, unknown>, items: Record<string, unknown>[]) {
  return {
    ...order,
    subtotal: parseDecimal(order.subtotal),
    discountAmount: parseDecimal(order.discountAmount ?? "0"),
    tax: parseDecimal(order.tax),
    deliveryFee: parseDecimal(order.deliveryFee),
    total: parseDecimal(order.total),
    items: items.map((i) => ({
      ...i,
      menuItemPrice: parseDecimal(i.menuItemPrice),
      subtotal: parseDecimal(i.subtotal),
    })),
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const queryParsed = ListOrdersQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).$dynamic();

  // Build up where clauses
  const conditions = [];
  if (queryParsed.data.status) {
    conditions.push(eq(ordersTable.status, queryParsed.data.status));
  }
  // Customer history filter (used by customer-facing order history)
  const phoneFilter = (req.query as Record<string, string>).customerPhone;
  if (phoneFilter) {
    conditions.push(eq(ordersTable.customerPhone, phoneFilter));
  }
  if (conditions.length === 1) {
    query = query.where(conditions[0]);
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions));
  }

  if (queryParsed.data.limit) {
    query = query.limit(queryParsed.data.limit);
  }

  const orders = await query;
  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));
      return formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]);
    })
  );
  res.json(result);
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!parsed.data.items || parsed.data.items.length === 0) {
    res.status(400).json({ error: "Order must have at least one item" });
    return;
  }

  const menuItemIds = parsed.data.items.map((i) => i.menuItemId);
  const menuItems = await db
    .select()
    .from(menuItemsTable)
    .where(
      menuItemIds.length === 1
        ? eq(menuItemsTable.id, menuItemIds[0])
        : inArray(menuItemsTable.id, menuItemIds)
    );

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItemsData = [];

  for (const item of parsed.data.items) {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) {
      res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      return;
    }
    if (!menuItem.available) {
      res.status(400).json({ error: `Menu item "${menuItem.name}" is not available` });
      return;
    }
    const price = parseFloat(menuItem.price as unknown as string);
    const modifierTotal = (item.modifierSelections ?? []).reduce((s: number, m: { price?: number }) => s + (m.price ?? 0), 0);
    const itemSubtotal = (price + modifierTotal) * item.quantity;
    subtotal += itemSubtotal;
    orderItemsData.push({
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
      menuItemPrice: price,
      quantity: item.quantity,
      notes: item.notes ?? null,
      modifierSelections: item.modifierSelections ?? null,
      itemSubtotal,
    });
  }

  const discountAmount = Math.round((parsed.data.discountAmount ?? 0) * 100) / 100;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const tax = Math.round(subtotalAfterDiscount * TAX_RATE * 100) / 100;
  const deliveryFee = 0;
  const total = Math.round((subtotalAfterDiscount + tax + deliveryFee) * 100) / 100;

  const confirmationCode = generateConfirmationCode();

  // Calculate estimated pickup time: count orders currently in active states
  const MINS_PER_ORDER = 5;  // each queued order adds 5 min
  const BASE_MINS = 3;       // minimum 3 min regardless
  const [{ value: activeOrderCount }] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(
      or(
        eq(ordersTable.status, "pending"),
        eq(ordersTable.status, "confirmed"),
        eq(ordersTable.status, "preparing")
      )
    );
  const estimatedMinutes = BASE_MINS + (Number(activeOrderCount) * MINS_PER_ORDER);
  const estimatedReadyAt = new Date(Date.now() + estimatedMinutes * 60 * 1000);

  const [order] = await db
    .insert(ordersTable)
    .values({
      confirmationCode,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail ?? "",
      customerPhone: parsed.data.customerPhone ?? "",
      orderType: parsed.data.orderType ?? "pickup",
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      // POS orders are auto-confirmed so they hit the KDS immediately.
      // Online orders stay "pending" until KDS staff accept or reject them.
      status: (parsed.data.source === "pos") ? "confirmed" : "pending",
      paymentStatus: parsed.data.paymentStatus ?? "pending",
      paymentMethod: parsed.data.paymentMethod,
      source: parsed.data.source ?? "online",
      subtotal: String(subtotal),
      discountAmount: String(discountAmount),
      tax: String(tax),
      deliveryFee: String(deliveryFee),
      total: String(total),
      notes: parsed.data.notes ?? null,
      estimatedReadyAt,
    })
    .returning();

  const items = await db
    .insert(orderItemsTable)
    .values(
      orderItemsData.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        menuItemPrice: String(item.menuItemPrice),
        quantity: item.quantity,
        notes: item.notes,
        modifierSelections: item.modifierSelections ?? null,
        subtotal: String(item.itemSubtotal),
      }))
    )
    .returning();

  // Auto-save/update customer record
  upsertCustomer(
    parsed.data.customerName,
    parsed.data.customerEmail ?? "",
    parsed.data.customerPhone ?? "",
    total,
  ).catch(() => {});

  res.status(201).json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

router.get("/orders/track/:confirmationCode", async (req, res): Promise<void> => {
  const params = TrackOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.confirmationCode, params.data.confirmationCode));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.estimatedReadyAt !== undefined) {
    updates.estimatedReadyAt = parsed.data.estimatedReadyAt;
  }
  if (parsed.data.cancellationReason !== undefined) {
    updates.cancellationReason = parsed.data.cancellationReason ?? null;
  }
  if (parsed.data.actualPaymentMethod) {
    updates.paymentMethod = parsed.data.actualPaymentMethod;
  }
  if (parsed.data.paymentStatus) {
    updates.paymentStatus = parsed.data.paymentStatus;
  }
  // Auto-mark as paid when completed from POS
  if (parsed.data.status === "completed" && !parsed.data.paymentStatus) {
    updates.paymentStatus = "paid";
  }

  const [order] = await db
    .update(ordersTable)
    .set(updates)
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

router.post("/orders/:id/refund", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { amount, reason, refundMethod = "cash" } = req.body as { amount: number; reason?: string; refundMethod?: string };
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount required" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const [refund] = await db.insert(refundsTable).values({
    orderId: id,
    amount: String(amount),
    reason: reason ?? null,
    refundMethod,
  }).returning();
  res.status(201).json({ ...refund, amount: parseFloat(refund.amount) });
});

router.get("/orders/:id/refunds", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const refunds = await db.select().from(refundsTable).where(eq(refundsTable.orderId, id));
  res.json(refunds.map(r => ({ ...r, amount: parseFloat(r.amount) })));
});

export default router;

