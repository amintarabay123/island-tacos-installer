import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable } from "@workspace/db";
import {
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  TrackOrderParams,
  ListOrdersQueryParams,
} from "@workspace/api-zod";
import { pushOrderToLoyverse } from "../lib/loyverse";

const router: IRouter = Router();

const TAX_RATE = 0;
const DELIVERY_FEE = 3.0;
const FREE_DELIVERY_THRESHOLD = 25.0;

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
  if (queryParsed.data.status) {
    query = query.where(eq(ordersTable.status, queryParsed.data.status));
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

  // Fetch menu items to validate and compute prices
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
    const itemSubtotal = price * item.quantity;
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

  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const deliveryFee =
    parsed.data.orderType === "delivery" && subtotal < FREE_DELIVERY_THRESHOLD
      ? DELIVERY_FEE
      : 0;
  const total = Math.round((subtotal + tax + deliveryFee) * 100) / 100;

  const confirmationCode = generateConfirmationCode();

  const [order] = await db
    .insert(ordersTable)
    .values({
      confirmationCode,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      orderType: parsed.data.orderType,
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: parsed.data.paymentMethod,
      subtotal: String(subtotal),
      tax: String(tax),
      deliveryFee: String(deliveryFee),
      total: String(total),
      notes: parsed.data.notes ?? null,
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
    .select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      menuItemId: orderItemsTable.menuItemId,
      menuItemName: orderItemsTable.menuItemName,
      menuItemPrice: orderItemsTable.menuItemPrice,
      quantity: orderItemsTable.quantity,
      notes: orderItemsTable.notes,
      modifierSelections: orderItemsTable.modifierSelections,
      subtotal: orderItemsTable.subtotal,
      loyverseItemId: menuItemsTable.loyverseItemId,
      loyverseVariantId: menuItemsTable.loyverseVariantId,
    })
    .from(orderItemsTable)
    .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .where(eq(orderItemsTable.orderId, order.id));

  // Push to Loyverse when staff completes the order (payment collected at counter)
  if (parsed.data.status === "completed" && process.env.LOYVERSE_API_TOKEN) {
    const effectivePaymentMethod = parsed.data.actualPaymentMethod || order.paymentMethod;
    pushOrderToLoyverse({
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      confirmationCode: order.confirmationCode,
      notes: order.notes,
      total: parseDecimal(order.total),
      paymentMethod: effectivePaymentMethod,
      items: items.map((i) => ({
        name: i.menuItemName,
        quantity: i.quantity,
        price: parseDecimal(i.menuItemPrice),
        notes: i.notes ?? null,
        modifierSelections: (i.modifierSelections as { modifierId: string; optionId: string; name: string; price: number }[] | null) ?? null,
        loyverseItemId: i.loyverseItemId ?? null,
        loyverseVariantId: i.loyverseVariantId ?? null,
      })),
    }).then((receiptNum) => {
      console.log(`[Loyverse] Order ${order.confirmationCode} → receipt ${receiptNum} (${effectivePaymentMethod})`);
    }).catch((err) => {
      console.error(`[Loyverse] Failed to push order ${order.confirmationCode}:`, err);
    });
  }

  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

export default router;
