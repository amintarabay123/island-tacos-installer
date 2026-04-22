import { Router, type IRouter } from "express";
import { eq, desc, and, inArray, count, or } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, refundsTable } from "@workspace/db";
import { upsertCustomer } from "./customers";
import nodemailer from "nodemailer";

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});
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
  if (queryParsed.data.kdsCleared !== undefined) {
    conditions.push(eq(ordersTable.kdsCleared, queryParsed.data.kdsCleared === "true"));
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

  // Single bulk fetch for all items — avoids N+1 (one query total instead of N+1)
  const orderIds = orders.map((o) => o.id);
  const allItems = orderIds.length > 0
    ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
    : [];
  const itemsByOrder = new Map<number, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  const result = orders.map((order) =>
    formatOrder(
      order as unknown as Record<string, unknown>,
      (itemsByOrder.get(order.id) ?? []) as unknown as Record<string, unknown>[],
    )
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
      alreadyMade: item.alreadyMade ?? false,
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
  const BASE_MINS = 10;      // minimum 10 min regardless
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
        alreadyMade: item.alreadyMade ?? false,
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
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }
  if (parsed.data.kdsCleared !== undefined) {
    updates.kdsCleared = parsed.data.kdsCleared;
  }
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
  // Auto-mark as paid when completed from POS (not from KDS clear)
  if (parsed.data.status === "completed" && !parsed.data.paymentStatus && !parsed.data.kdsCleared) {
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

router.post("/orders/:id/email-receipt", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { toEmail } = req.body as { toEmail?: string };

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

  const recipient = toEmail || order.customerEmail;
  if (!recipient) { res.status(400).json({ error: "No email address provided" }); return; }

  const fmt = (n: unknown) => `$${parseFloat(n as string).toFixed(2)}`;
  const PAY_LABEL: Record<string, string> = { cash: "Cash", card: "Card", athmovil: "ATH Móvil", split: "Split" };

  const itemRows = items.map(i => {
    const mods = (i.modifierSelections as { name: string; price: number }[] | null ?? []);
    const modLines = mods.map(m => `<tr><td style="padding:1px 0 1px 16px;color:#888;font-size:13px">+ ${m.name}</td><td style="text-align:right;color:#888;font-size:13px">${m.price > 0 ? `+${fmt(m.price)}` : ""}</td></tr>`).join("");
    return `<tr><td style="padding:4px 0;font-size:14px">${i.quantity}× ${i.menuItemName}</td><td style="text-align:right;font-size:14px;font-weight:600">${fmt(i.subtotal)}</td></tr>${modLines}`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Receipt #${order.confirmationCode}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#1a1f36;padding:28px 32px;text-align:center">
          <div style="color:#f5a623;font-size:26px;font-weight:800;letter-spacing:1px">🌮 ISLAND TACOS</div>
          <div style="color:#aaa;font-size:13px;margin-top:4px">Wickhams Cay 1, Road Town, BVI</div>
        </td></tr>
        <!-- Receipt info -->
        <tr><td style="padding:24px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#666">Order #</td>
              <td style="text-align:right;font-size:13px;color:#666">${new Date(order.createdAt).toLocaleString("en-US",{timeZone:"America/Puerto_Rico"})}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:4px">
                <span style="font-size:22px;font-weight:800;color:#1a1f36">${order.confirmationCode}</span>
              </td>
            </tr>
          </table>
          <div style="margin-top:8px;font-size:14px;color:#555">Hi <strong>${order.customerName || "there"}</strong>, thank you for your order!</div>
        </td></tr>
        <!-- Divider -->
        <tr><td style="padding:16px 32px"><hr style="border:none;border-top:1px dashed #ddd;margin:0"></td></tr>
        <!-- Items -->
        <tr><td style="padding:0 32px">
          <table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
        </td></tr>
        <!-- Divider -->
        <tr><td style="padding:16px 32px"><hr style="border:none;border-top:1px dashed #ddd;margin:0"></td></tr>
        <!-- Totals -->
        <tr><td style="padding:0 32px 8px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:13px;color:#666;padding:2px 0">Subtotal</td><td style="text-align:right;font-size:13px;color:#666">${fmt(order.subtotal)}</td></tr>
            ${parseFloat(order.discountAmount as string) > 0 ? `<tr><td style="font-size:13px;color:#22c55e;padding:2px 0">Discount</td><td style="text-align:right;font-size:13px;color:#22c55e">-${fmt(order.discountAmount)}</td></tr>` : ""}
            ${parseFloat(order.tax as string) > 0 ? `<tr><td style="font-size:13px;color:#666;padding:2px 0">Tax</td><td style="text-align:right;font-size:13px;color:#666">${fmt(order.tax)}</td></tr>` : ""}
            <tr><td style="font-size:18px;font-weight:800;color:#1a1f36;padding:8px 0 4px;border-top:2px solid #1a1f36">TOTAL</td><td style="text-align:right;font-size:18px;font-weight:800;color:#f5a623;border-top:2px solid #1a1f36">${fmt(order.total)}</td></tr>
            <tr><td style="font-size:13px;color:#888;padding:4px 0" colspan="2">Payment: ${PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}</td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;text-align:center;background:#fafafa;border-top:1px solid #eee">
          <div style="color:#888;font-size:13px">Thank you for dining with us! 🌴</div>
          <div style="color:#bbb;font-size:12px;margin-top:4px">orders@islandtacosbvi.com</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM ?? "Island Tacos <orders@islandtacosbvi.com>",
      to: recipient,
      subject: `Your Island Tacos Receipt — Order #${order.confirmationCode}`,
      html,
    });
    // If a new email was provided and not already on the order, update the order
    if (toEmail && !order.customerEmail) {
      await db.update(ordersTable).set({ customerEmail: toEmail }).where(eq(ordersTable.id, id));
    }
    res.json({ ok: true, sentTo: recipient });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: msg });
  }
});

export default router;

