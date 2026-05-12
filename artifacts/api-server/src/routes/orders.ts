import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, inArray, count, or, gte } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, refundsTable, storeSettingsTable } from "@workspace/db";
import { upsertCustomer } from "./customers";
import { SETTING_DEFAULTS, computeStoreStatus } from "./settings";
import { broadcastOrderEvent } from "./pos-events";
import { isBVIMobile, formatBVIPhone } from "../lib/phone-utils";
import { pushStatusToCloud } from "../lib/online-orders-sync";
import { sendOrderConfirmationWhatsApp, sendOrderReadyWhatsApp } from "../lib/whatsapp";
import { sendSms } from "../lib/sms-gateway";
import nodemailer from "nodemailer";
import { requireStaffAuth, isStaffAuthenticated } from "./auth";

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
    amountTendered: order.amountTendered != null ? parseDecimal(order.amountTendered) : null,
    items: items.map((i) => ({
      ...i,
      menuItemPrice: parseDecimal(i.menuItemPrice),
      subtotal: parseDecimal(i.subtotal),
    })),
  };
}

const STORE_URL = process.env.STORE_URL ?? "https://orders.islandtacosbvi.com";
// TODO(store-settings): replace fallback with `${(await getStoreSettings()).storeName} <${(await getStoreSettings()).email}>`
const SMTP_FROM  = process.env.SMTP_FROM  ?? "Island Tacos <orders@islandtacosbvi.com>";

function fmtMoney(n: unknown) { return `$${parseFloat(n as string).toFixed(2)}`; }
const PAY_LABEL: Record<string, string> = { cash: "Cash", card: "Card", athmovil: "ATH Móvil", split: "Split", complimentary: "Comp" };

function emailShell(bodyContent: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <tr><td style="background:#1a1a1a;padding:24px 32px;text-align:center">
    <!-- TODO(store-settings): use getStoreSettings().storeName (and .address) -->
    <div style="color:#e05a00;font-size:24px;font-weight:800;letter-spacing:1px">🌮 ISLAND TACOS</div>
    <div style="color:#999;font-size:12px;margin-top:4px">Wickhams Cay 1, Road Town, BVI</div>
  </td></tr>
  ${bodyContent}
  <tr><td style="padding:20px 32px;text-align:center;background:#fafaf8;border-top:1px solid #eee">
    <!-- TODO(store-settings): use getStoreSettings().storeName + .email -->
    <div style="color:#aaa;font-size:12px">© Island Tacos · orders@islandtacosbvi.com</div>
  </td></tr>
</table>
</td></tr>
</table></body></html>`;
}

type OrderRow = typeof import("@workspace/db").ordersTable.$inferSelect;
type OrderItemRow = typeof import("@workspace/db").orderItemsTable.$inferSelect;

function buildItemRows(items: OrderItemRow[]) {
  return items.map(i => {
    const mods = (i.modifierSelections as { name: string; price: number }[] | null ?? []);
    const modLines = mods.map(m => `<tr><td style="padding:1px 0 1px 16px;color:#999;font-size:13px">+ ${m.name}</td><td style="text-align:right;color:#999;font-size:13px">${m.price > 0 ? `+${fmtMoney(m.price)}` : ""}</td></tr>`).join("");
    return `<tr><td style="padding:4px 0;font-size:14px">${i.quantity}× ${i.menuItemName}${i.notes ? `<br><span style="color:#999;font-size:12px">${i.notes}</span>` : ""}</td><td style="text-align:right;font-size:14px;font-weight:600">${fmtMoney(i.subtotal)}</td></tr>${modLines}`;
  }).join("");
}

async function sendConfirmationEmail(order: OrderRow, items: OrderItemRow[]) {
  if (!order.customerEmail) return;
  const trackUrl = `${STORE_URL}/track?code=${order.confirmationCode}`;
  const estimatedTime = order.estimatedReadyAt
    ? new Date(order.estimatedReadyAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" })
    : null;

  const html = emailShell(`
    <tr><td style="padding:28px 32px 8px;text-align:center">
      <div style="font-size:36px">✅</div>
      <div style="font-size:20px;font-weight:800;color:#1a1a1a;margin-top:8px">Order Confirmed!</div>
      <div style="font-size:13px;color:#666;margin-top:6px">Hi <strong>${order.customerName || "there"}</strong> — we've got your order and we're getting it ready.</div>
    </td></tr>
    <tr><td style="padding:12px 32px">
      <div style="background:#f5f5f0;border-radius:10px;padding:16px 20px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px">Your Order Code</div>
        <div style="font-size:34px;font-weight:900;letter-spacing:4px;color:#e05a00">${order.confirmationCode}</div>
        ${estimatedTime ? `<div style="font-size:13px;color:#666;margin-top:6px">Estimated ready at <strong>${estimatedTime}</strong></div>` : ""}
      </div>
    </td></tr>
    <tr><td style="padding:4px 32px 0"><hr style="border:none;border-top:1px dashed #ddd;margin:0"></td></tr>
    <tr><td style="padding:12px 32px 4px">
      <table width="100%" cellpadding="0" cellspacing="0">${buildItemRows(items)}</table>
    </td></tr>
    <tr><td style="padding:4px 32px 12px"><hr style="border:none;border-top:1px dashed #ddd;margin:0"></td></tr>
    <tr><td style="padding:0 32px 20px">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${parseFloat(order.discountAmount as string) > 0 ? `<tr><td style="font-size:13px;color:#22c55e;padding:2px 0">Discount</td><td style="text-align:right;font-size:13px;color:#22c55e">-${fmtMoney(order.discountAmount)}</td></tr>` : ""}
        <tr><td style="font-size:16px;font-weight:800;color:#1a1a1a;padding:6px 0 2px;border-top:2px solid #1a1a1a">TOTAL</td><td style="text-align:right;font-size:16px;font-weight:800;color:#e05a00;border-top:2px solid #1a1a1a">${fmtMoney(order.total)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center">
      <a href="${trackUrl}" style="display:inline-block;background:#e05a00;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px">Track My Order →</a>
      <div style="font-size:12px;color:#aaa;margin-top:10px">We'll email you again the moment it's ready for pickup.</div>
    </td></tr>
  `);

  await mailer.sendMail({
    from: SMTP_FROM,
    to: order.customerEmail,
    subject: `Order Confirmed — #${order.confirmationCode} 🌮`,
    html,
  });
}

async function sendReadyEmail(order: OrderRow) {
  if (!order.customerEmail) return;

  const html = emailShell(`
    <tr><td style="padding:28px 32px 8px;text-align:center">
      <div style="font-size:48px">🔔</div>
      <div style="font-size:22px;font-weight:900;color:#1a1a1a;margin-top:8px">Your Order is Ready!</div>
      <div style="font-size:14px;color:#666;margin-top:6px">Hi <strong>${order.customerName || "there"}</strong> — come grab your food!</div>
    </td></tr>
    <tr><td style="padding:16px 32px 24px">
      <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:10px;padding:16px 20px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:4px">Your Order Code</div>
        <div style="font-size:36px;font-weight:900;letter-spacing:4px;color:#16a34a">${order.confirmationCode}</div>
        <div style="font-size:13px;color:#555;margin-top:8px;font-weight:600">📍 Wickhams Cay 1, Road Town, BVI</div>
        <div style="font-size:12px;color:#888;margin-top:4px">Total: ${fmtMoney(order.total)} · ${PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}</div>
      </div>
    </td></tr>
  `);

  await mailer.sendMail({
    from: SMTP_FROM,
    to: order.customerEmail,
    subject: `Your order is ready for pickup! 🌮 #${order.confirmationCode}`,
    html,
  });
}

/**
 * Send an "order ready" SMS through the on-site SMS Gateway phone
 * (BVI business number, free per message via the unlimited cellular plan).
 *
 * Restricted to BVI mobiles to avoid international carrier charges from
 * the business SIM. International customers get email/WhatsApp instead.
 */
async function sendReadySMS(order: OrderRow) {
  if (!order.customerPhone) return;

  const normalizedPhone = formatBVIPhone(order.customerPhone);
  if (!isBVIMobile(normalizedPhone)) return;

  // TODO(store-settings): replace literal with `${(await getStoreSettings()).storeName}: order #…`
  const body = `Island Tacos: order #${order.confirmationCode} is ready for pickup!`;
  await sendSms(normalizedPhone, body);
}

/**
 * Send a cancellation SMS when a phone/online order is rejected by the POS.
 * Restricted to BVI mobiles (same reason as sendReadySMS — international SMS
 * from the business SIM is not free).
 */
async function sendCancellationSMS(order: OrderRow, _reason: string | null) {
  if (!order.customerPhone) return;

  const normalizedPhone = formatBVIPhone(order.customerPhone);
  if (!isBVIMobile(normalizedPhone)) return;

  // Kept short: 1 SMS segment. Reason is intentionally NOT included to keep
  // it under 160 chars; staff should follow up by phone for the details.
  // TODO(store-settings): replace "Island Tacos" with .storeName and "(284) 544-8088" with .phone
  const body = `Island Tacos: sorry, order #${order.confirmationCode} was cancelled. Call (284) 544-8088.`;
  await sendSms(normalizedPhone, body);
}

// Carve-out: customer-facing track.tsx queries by ?customerPhone= (their own
// history). All other listings (POS/KDS/admin) require staff auth.
function requireStaffUnlessCustomerPhoneHistory(req: Request, res: Response, next: () => void): void {
  const phoneFilter = (req.query as Record<string, string>).customerPhone;
  if (phoneFilter) { next(); return; }
  requireStaffAuth(req, res, next);
}

router.get("/orders", requireStaffUnlessCustomerPhoneHistory, async (req, res): Promise<void> => {
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
  try {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!parsed.data.items || parsed.data.items.length === 0) {
    res.status(400).json({ error: "Order must have at least one item" });
    return;
  }

  // Enforce business hours for online orders only + validate scheduled pickup
  let scheduledPickupAtDate: Date | null = null;
  if (parsed.data.source !== "pos") {
    const settingRows = await db.select().from(storeSettingsTable);
    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) settings[row.key] = row.value;
    const { is_open } = computeStoreStatus(settings);
    if (!is_open) {
      const [ch, cm] = (settings.open_time ?? "11:00").split(":").map(Number);
      const ampm = ch >= 12 ? "PM" : "AM";
      const hour = ch % 12 || 12;
      const opensAt = `${hour}:${String(cm).padStart(2, "0")} ${ampm}`;
      res.status(403).json({ error: `We're not accepting orders right now. We open at ${opensAt} AST.`, code: "CLOSED" });
      return;
    }

    // Validate scheduled pickup time if provided
    if (parsed.data.scheduledPickupAt) {
      const d = new Date(parsed.data.scheduledPickupAt);
      if (isNaN(d.getTime())) {
        res.status(400).json({ error: "Invalid scheduled pickup time" });
        return;
      }
      // Must be at least 15 minutes in the future
      if (d.getTime() < Date.now() + 15 * 60 * 1000) {
        res.status(400).json({ error: "Scheduled pickup must be at least 15 minutes from now" });
        return;
      }
      // Must be same day in BVI and before closing time
      const bviScheduled = new Date(d.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
      const bviNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
      if (bviScheduled.toDateString() !== bviNow.toDateString()) {
        res.status(400).json({ error: "Scheduled orders must be for today only" });
        return;
      }
      const scheduledMins = bviScheduled.getHours() * 60 + bviScheduled.getMinutes();
      const [closeH, closeM] = (settings.close_time ?? "19:00").split(":").map(Number);
      if (scheduledMins >= closeH * 60 + closeM) {
        res.status(400).json({ error: "Scheduled time must be before closing time" });
        return;
      }
      scheduledPickupAtDate = d;
    }
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
    // Open-price items (e.g. "Misc") let the cashier set a one-off price at the POS.
    // We only honor priceOverride when the menu item is flagged openPrice — never trust
    // a client-supplied price for normal items. Open-price is also a staff-only feature:
    // unauthenticated callers (the public storefront) must NOT be able to order them,
    // otherwise anyone could POST a $0.01 order for a "Misc" item.
    let price: number;
    if (menuItem.openPrice) {
      if (!isStaffAuthenticated(req)) {
        res.status(403).json({ error: `"${menuItem.name}" can only be added from the POS` });
        return;
      }
      const override = item.priceOverride;
      if (typeof override !== "number" || !Number.isFinite(override) || override <= 0) {
        res.status(400).json({ error: `"${menuItem.name}" requires a price greater than 0` });
        return;
      }
      price = override;
    } else {
      price = parseFloat(menuItem.price as unknown as string);
    }
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
      amountTendered: parsed.data.amountTendered != null ? String(parsed.data.amountTendered) : null,
      notes: parsed.data.notes ?? null,
      estimatedReadyAt: scheduledPickupAtDate ?? estimatedReadyAt,
      scheduledPickupAt: scheduledPickupAtDate,
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

  // Send confirmation email for online orders with an email address
  if (order.source !== "pos" && order.customerEmail) {
    sendConfirmationEmail(order, items).catch((err) =>
      console.error("[email] confirmation failed:", err?.message)
    );
  }
  // Send WhatsApp confirmation for online orders with a phone number
  if (order.source !== "pos" && order.customerPhone) {
    sendOrderConfirmationWhatsApp(order).catch((err) =>
      console.error("[whatsapp] confirmation failed:", err?.message)
    );
  }

  broadcastOrderEvent("order_created", order.id);
  res.status(201).json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : err instanceof Error && err.cause
        ? String(err.cause)
        : undefined;
    req.log.error({ err }, "order creation failed");
    res.status(500).json({ error: "Order failed", detail: message, cause });
  }
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

// Local → cloud status write-back endpoint
// Called by the local server when kitchen/POS changes an online order's status.
// Cloud updates its DB and fires the customer notification (email + SMS).
// Protected by SYNC_SECRET — no session auth required.
router.patch("/orders/sync-status", async (req, res): Promise<void> => {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret || req.headers.authorization !== `Bearer ${syncSecret}`) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const { confirmationCode, status, kdsCleared, estimatedReadyAt, cancellationReason, paymentStatus, amountTendered } =
    req.body as {
      confirmationCode: string;
      status?: string;
      kdsCleared?: boolean;
      estimatedReadyAt?: string | null;
      cancellationReason?: string | null;
      paymentStatus?: string;
      amountTendered?: string | null;
    };

  if (!confirmationCode) { res.status(400).json({ error: "confirmationCode required" }); return; }

  const updates: Record<string, unknown> = {};
  if (status !== undefined)            updates.status = status;
  if (kdsCleared !== undefined)        updates.kdsCleared = kdsCleared;
  if (estimatedReadyAt !== undefined)  updates.estimatedReadyAt = estimatedReadyAt ? new Date(estimatedReadyAt) : null;
  if (cancellationReason !== undefined) updates.cancellationReason = cancellationReason ?? null;
  if (paymentStatus !== undefined)     updates.paymentStatus = paymentStatus;
  if (amountTendered !== undefined)    updates.amountTendered = amountTendered;

  if (Object.keys(updates).length === 0) { res.json({ ok: true }); return; }

  const [order] = await db
    .update(ordersTable)
    .set(updates)
    .where(eq(ordersTable.confirmationCode, confirmationCode))
    .returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Cloud fires the customer notification (local server deliberately skips this)
  if (status === "ready") {
    if (order.customerEmail) sendReadyEmail(order).catch(() => {});
    if (order.customerPhone) sendReadySMS(order).catch(() => {});
    if (order.customerPhone) sendOrderReadyWhatsApp(order).catch(() => {});
  }
  if (status === "cancelled" && order.customerPhone) {
    sendCancellationSMS(order, cancellationReason ?? null).catch(() => {});
  }

  broadcastOrderEvent("order_updated", order.id);
  res.json({ ok: true });
});

// Cloud → local sync export endpoint
// Called by the local server every 5 s to pull new online orders.
// Protected by a shared SYNC_SECRET bearer token.
router.get("/orders/online-sync", async (req, res): Promise<void> => {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret || req.headers.authorization !== `Bearer ${syncSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sinceStr = req.query.since as string | undefined;
  const since = sinceStr ? new Date(sinceStr) : new Date(Date.now() - 2 * 60 * 60 * 1000);
  if (isNaN(since.getTime())) {
    res.status(400).json({ error: "Invalid since timestamp" });
    return;
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.source, "online"), gte(ordersTable.createdAt, since)))
    .orderBy(ordersTable.createdAt);

  if (orders.length === 0) { res.json([]); return; }

  const orderIds = orders.map((o) => o.id);
  const allItems = await db
    .select()
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, orderIds));

  const itemsByOrder = new Map<number, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const result = orders.map((order) => ({
    order: {
      confirmationCode:  order.confirmationCode,
      customerName:      order.customerName,
      customerEmail:     order.customerEmail,
      customerPhone:     order.customerPhone,
      orderType:         order.orderType,
      deliveryAddress:   order.deliveryAddress,
      status:            order.status,
      paymentStatus:     order.paymentStatus,
      paymentMethod:     order.paymentMethod,
      subtotal:          order.subtotal,
      discountAmount:    order.discountAmount,
      tax:               order.tax,
      deliveryFee:       order.deliveryFee,
      total:             order.total,
      notes:             order.notes,
      createdAt:         order.createdAt,
    },
    items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
      menuItemId:         item.menuItemId,
      menuItemName:       item.menuItemName,
      menuItemPrice:      item.menuItemPrice,
      quantity:           item.quantity,
      notes:              item.notes,
      modifierSelections: item.modifierSelections,
      subtotal:           item.subtotal,
    })),
  }));

  res.json(result);
});

router.get("/orders/:id", requireStaffAuth, async (req, res): Promise<void> => {
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

router.patch("/orders/:id", requireStaffAuth, async (req, res): Promise<void> => {
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
  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes ?? null;
  }
  if (parsed.data.amountTendered !== undefined) {
    updates.amountTendered = parsed.data.amountTendered != null ? String(parsed.data.amountTendered) : null;
  }
  // Auto-mark as paid when completed from POS (not from KDS clear)
  if (parsed.data.status === "completed" && !parsed.data.paymentStatus && !parsed.data.kdsCleared) {
    updates.paymentStatus = "paid";
  }
  // Void/cancel: reset payment so the order doesn't count as a sale in reports
  // or in the shift Z-report's expected cash. Order row is preserved as audit trail.
  if (parsed.data.status === "cancelled" && !parsed.data.paymentStatus) {
    updates.paymentStatus = "pending";
    updates.amountTendered = null;
  }

  let order;
  if (Object.keys(updates).length === 0) {
    // Nothing to update (e.g. re-hold with no changes) — fetch existing order as-is
    [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));
  } else {
    [order] = await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, params.data.id))
      .returning();
  }
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const isLocalMode = !!process.env.SYNC_TARGET_URL;
  const isOnlineOrder = order.source === "online";

  if (isLocalMode && isOnlineOrder) {
    // Local server: push status back to cloud — cloud handles all notifications.
    // This avoids duplicate SMS/email (local + cloud both firing).
    pushStatusToCloud(order.confirmationCode, {
      status:               parsed.data.status,
      kdsCleared:           parsed.data.kdsCleared,
      estimatedReadyAt:     parsed.data.estimatedReadyAt ? new Date(parsed.data.estimatedReadyAt) : undefined,
      cancellationReason:   parsed.data.cancellationReason,
      // Propagate any payment-state changes (explicit from client OR implicit from
      // the auto-paid-on-complete / auto-pending-on-cancel logic above) so cloud
      // stays in sync with local. Without this, voided orders count as paid on cloud.
      paymentStatus:        updates.paymentStatus as string | undefined,
      amountTendered:       updates.amountTendered as string | null | undefined,
    });
  } else {
    // Cloud (or local POS orders): send notifications directly from this server.
    if (parsed.data.status === "ready") {
      if (order.customerEmail) {
        sendReadyEmail(order).catch((err) =>
          console.error("[email] ready notification failed:", err?.message)
        );
      }
      if (order.customerPhone) {
        sendReadySMS(order).catch((err) =>
          console.error("[sms] ready notification failed:", err?.message)
        );
        sendOrderReadyWhatsApp(order).catch((err) =>
          console.error("[whatsapp] ready notification failed:", err?.message)
        );
      }
    }
    if (
      parsed.data.status === "cancelled" &&
      (order.source === "phone" || order.source === "online") &&
      order.customerPhone
    ) {
      sendCancellationSMS(order, parsed.data.cancellationReason ?? null).catch((err) =>
        console.error("[sms] cancellation notification failed:", err?.message)
      );
    }
  }

  broadcastOrderEvent("order_updated", order.id);
  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

router.post("/orders/:id/refund", requireStaffAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
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
  await db.update(ordersTable).set({ paymentStatus: "refunded" }).where(eq(ordersTable.id, id));
  res.status(201).json({ ...refund, amount: parseFloat(refund.amount) });
});

router.get("/orders/:id/refunds", requireStaffAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const refunds = await db.select().from(refundsTable).where(eq(refundsTable.orderId, id));
  res.json(refunds.map(r => ({ ...r, amount: parseFloat(r.amount) })));
});

router.post("/orders/:id/email-receipt", requireStaffAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
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
    // TODO(store-settings): replace fallback + subject with `${(await getStoreSettings()).storeName}` everywhere
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

