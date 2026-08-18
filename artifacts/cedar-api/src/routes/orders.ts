import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, inArray, count, or, gte, ne, notInArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, menuCategoriesTable, refundsTable, storeSettingsTable, paymentEventsTable } from "@workspace/db";
import { upsertCustomer } from "./customers";
import { SETTING_DEFAULTS, computeStoreStatus } from "./settings";
import { broadcastOrderEvent } from "./pos-events";
import { isBVIMobile, formatBVIPhone, normalizePhoneForWhatsApp } from "../lib/phone-utils";
import { pushStatusToCloud } from "../lib/online-orders-sync";
import { sendOrderConfirmationWhatsApp, sendOrderReadyWhatsApp, sendOrderCancelledWhatsApp, sendWhatsAppMessage, sendOrderReceiptWhatsApp, WhatsAppApiError } from "../lib/whatsapp";
import { buildReceiptPdf } from "../lib/receipt-pdf";
import { sendSms } from "../lib/sms-gateway";
import nodemailer from "nodemailer";
import { requireStaffAuth, isStaffAuthenticated } from "./auth";
import { logger } from "../lib/logger";
import { getStoreSettings } from "../lib/store-settings";

/**
 * Normalise any phone number to raw E.164 digits (no + prefix) at save time
 * so every downstream consumer (WhatsApp API, SMS, webhook lookup) gets a
 * consistent format.  Empty string is returned as-is (phone is optional).
 * Examples: "5555555" → "12845555555", "284-555-5555" → "12845555555"
 */
function normalizePhone(raw: string): string {
  if (!raw.trim()) return "";
  return formatBVIPhone(raw).replace(/^\+/, "");
}

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
  const prefix = (process.env.CONFIRMATION_CODE_PREFIX ?? "IT").toUpperCase();
  let code = prefix;
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

function fmtMoney(n: unknown) { return `$${parseFloat(n as string).toFixed(2)}`; }
const PAY_LABEL: Record<string, string> = { cash: "Cash", card: "Card", athmovil: "ATH Móvil", split: "Split", complimentary: "Comp" };

function emailShell(bodyContent: string, store: { storeName: string; address: string; email: string }) {
  const footer = store.email ? `${store.storeName} · ${store.email}` : store.storeName;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <tr><td style="background:#1a1a1a;padding:24px 32px;text-align:center">
    <div style="color:#e05a00;font-size:24px;font-weight:800;letter-spacing:1px">${store.storeName.toUpperCase()}</div>
    ${store.address ? `<div style="color:#999;font-size:12px;margin-top:4px">${store.address}</div>` : ""}
  </td></tr>
  ${bodyContent}
  <tr><td style="padding:20px 32px;text-align:center;background:#fafaf8;border-top:1px solid #eee">
    <div style="color:#aaa;font-size:12px">© ${footer}</div>
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
  const store = await getStoreSettings();
  const smtpFrom = process.env.SMTP_FROM ?? `${store.storeName} <${store.email || "no-reply@example.com"}>`;
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
  `, store);

  await mailer.sendMail({
    from: smtpFrom,
    to: order.customerEmail,
    subject: `Order Confirmed — #${order.confirmationCode}`,
    html,
  });
}

/**
 * Called by payments.ts after card/ATH payment is confirmed.
 * Fires the POS broadcast + customer notifications that were held at order
 * creation time (because payment was still pending).
 */
export async function notifyOrderPaid(orderId: number): Promise<void> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return;

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));

  broadcastOrderEvent("order_created", orderId);

  if (order.customerEmail) {
    sendConfirmationEmail(order, items).catch((err) =>
      logger.error({ err: err?.message }, "[email] post-payment confirmation failed")
    );
  }
  if (order.customerPhone) {
    sendOrderConfirmationWhatsApp(order).catch((err) =>
      logger.error({ err: err?.message }, "[whatsapp] post-payment confirmation failed")
    );
  }
}

async function sendReadyEmail(order: OrderRow) {
  if (!order.customerEmail) return;

  const store = await getStoreSettings();
  const smtpFrom = process.env.SMTP_FROM ?? `${store.storeName} <${store.email || "no-reply@example.com"}>`;
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
        ${store.address ? `<div style="font-size:13px;color:#555;margin-top:8px;font-weight:600">📍 ${store.address}</div>` : ""}
        <div style="font-size:12px;color:#888;margin-top:4px">Total: ${fmtMoney(order.total)} · ${PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}</div>
      </div>
    </td></tr>
  `, store);

  await mailer.sendMail({
    from: smtpFrom,
    to: order.customerEmail,
    subject: `Your order is ready for pickup! #${order.confirmationCode}`,
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

  const { storeName } = await getStoreSettings();
  const body = `${storeName}: order #${order.confirmationCode} is ready for pickup!`;
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

  // Kept short: 1 SMS segment. Reason intentionally NOT included (keep ≤160 chars).
  const { storeName, phone } = await getStoreSettings();
  const callLine = phone ? ` Call ${phone}.` : "";
  const body = `${storeName}: sorry, order #${order.confirmationCode} was cancelled.${callLine}`;
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

  // Always hide online card/ATH orders that haven't been paid yet.
  // These are awaiting Placetopay/ATH Móvil confirmation and should not
  // appear in the POS queue or admin until payment clears.
  // "Pay at counter" (cash) online orders are unaffected (paymentMethod = 'cash').
  // POS orders are always included regardless of paymentMethod.
  conditions.push(
    or(
      eq(ordersTable.source, "pos"),
      ne(ordersTable.paymentStatus, "pending"),
      notInArray(ordersTable.paymentMethod, ["card", "athmovil"]),
    )!
  );

  if (queryParsed.data.status) {
    conditions.push(eq(ordersTable.status, queryParsed.data.status));
  }
  if (queryParsed.data.kdsCleared !== undefined) {
    conditions.push(eq(ordersTable.kdsCleared, queryParsed.data.kdsCleared === "true"));
  }
  // activeOnly=true → only open tickets: everything except cancelled orders and
  // completed+paid orders (completed+UNPAID must stay visible so staff can still
  // charge them). This keeps the POS tickets drawer payload small — without it
  // the POS downloads the entire order history and freezes on low-power devices.
  if (queryParsed.data.activeOnly === "true") {
    conditions.push(ne(ordersTable.status, "cancelled"));
    conditions.push(
      or(
        ne(ordersTable.status, "completed"),
        ne(ordersTable.paymentStatus, "paid"),
      )!
    );
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

  // In dev mode, reject order creation requests that originate from the
  // production domain. This prevents production customers from accidentally
  // hitting the dev server (same shared DB) and avoids test orders mingling
  // with real ones. POS orders (source=pos) are always allowed.
  if (process.env.NODE_ENV === "development" && parsed.data.source !== "pos") {
    const origin = (req.headers.origin ?? req.headers.referer ?? "") as string;
    const PROD_DOMAINS = (process.env.PRODUCTION_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
    const isProduction = PROD_DOMAINS.some(d => origin.includes(d));
    if (isProduction) {
      req.log.warn({ origin }, "[orders] rejected production-origin order in dev mode");
      res.status(403).json({ error: "Dev server does not accept orders from the production site." });
      return;
    }
  }

  // Enforce business hours for online orders only + validate scheduled pickup
  let scheduledPickupAtDate: Date | null = null;
  if (parsed.data.source !== "pos") {
    const settingRows = await db.select().from(storeSettingsTable);
    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) settings[row.key] = row.value;
    const { is_open } = computeStoreStatus(settings);
    const devOverride = process.env.NODE_ENV === "development";
    if (!devOverride && !is_open) {
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

  // Only look up menu items that are still present in the DB (non-null IDs).
  // Items with a null menuItemId were on a held POS ticket when their menu entry was
  // deleted; those items carry snapshotted name/price from the client and are allowed
  // for staff (POS) orders only.
  const nonNullMenuItemIds = parsed.data.items
    .map((i) => i.menuItemId)
    .filter((id): id is number => id != null);

  const menuItems = nonNullMenuItemIds.length > 0
    ? await db
        .select()
        .from(menuItemsTable)
        .where(
          nonNullMenuItemIds.length === 1
            ? eq(menuItemsTable.id, nonNullMenuItemIds[0])
            : inArray(menuItemsTable.id, nonNullMenuItemIds)
        )
    : [];

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItemsData = [];

  for (const item of parsed.data.items) {
    let itemName: string;
    let price: number;

    if (item.menuItemId == null) {
      // Deleted menu item — only POS staff may submit these.
      if (!isStaffAuthenticated(req)) {
        res.status(403).json({ error: "Cannot order a deleted menu item from the online storefront" });
        return;
      }
      if (!item.menuItemName || typeof item.menuItemPrice !== "number") {
        res.status(400).json({ error: "Deleted menu item must supply menuItemName and menuItemPrice" });
        return;
      }
      itemName = item.menuItemName;
      price = item.menuItemPrice;
    } else {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
        return;
      }
      if (!menuItem.available) {
        res.status(400).json({ error: `Menu item "${menuItem.name}" is not available` });
        return;
      }
      // Items hidden from the online menu can't be ordered by anonymous customers either —
      // otherwise someone with a retained item id could still order it. POS/staff may.
      if (menuItem.hiddenOnline && !isStaffAuthenticated(req)) {
        res.status(400).json({ error: `Menu item "${menuItem.name}" is not available` });
        return;
      }
      // Open-price items (e.g. "Misc") let the cashier set a one-off price at the POS.
      // We only honor priceOverride when the menu item is flagged openPrice — never trust
      // a client-supplied price for normal items. Open-price is also a staff-only feature:
      // unauthenticated callers (the public storefront) must NOT be able to order them,
      // otherwise anyone could POST a $0.01 order for a "Misc" item.
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
      itemName = menuItem.name;
    }

    const modifierTotal = (item.modifierSelections ?? []).reduce((s: number, m: { price?: number }) => s + (m.price ?? 0), 0);
    const itemSubtotal = (price + modifierTotal) * item.quantity;
    subtotal += itemSubtotal;
    orderItemsData.push({
      menuItemId: item.menuItemId ?? null,
      menuItemName: itemName,
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
      customerPhone: normalizePhone(parsed.data.customerPhone ?? ""),
      orderType: parsed.data.orderType ?? "pickup",
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      // POS orders are auto-confirmed so they hit the KDS immediately.
      // Online orders stay "pending" until KDS staff accept or reject them.
      // Exception: POS orders created already-paid with no kitchen items can
      // skip the KDS workflow by sending status:"completed" explicitly.
      status: (parsed.data.source === "pos" && parsed.data.status === "completed" && parsed.data.paymentStatus === "paid")
        ? "completed"
        : (parsed.data.source === "pos") ? "confirmed" : "pending",
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
    normalizePhone(parsed.data.customerPhone ?? ""),
    total,
  ).catch(() => {});

  // Online card orders (Placetopay / ATH Móvil) are awaiting payment — hold
  // POS notifications and customer confirmations until payment is verified.
  // "Pay at pickup" online orders and all POS orders notify immediately.
  const awaitingPayment =
    order.source !== "pos" &&
    (order.paymentMethod === "card" || order.paymentMethod === "athmovil");

  if (!awaitingPayment) {
    // Send confirmation email for online orders with an email address
    if (order.source !== "pos" && order.customerEmail) {
      sendConfirmationEmail(order, items).catch((err) =>
        logger.error({ err: err?.message }, "[email] confirmation failed")
      );
    }
    // Send WhatsApp confirmation for online orders with a phone number
    if (order.source !== "pos" && order.customerPhone) {
      sendOrderConfirmationWhatsApp(order).catch((err) =>
        logger.error({ err: err?.message }, "[whatsapp] confirmation failed")
      );
    }
    broadcastOrderEvent("order_created", order.id);
  }
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
    sendOrderCancelledWhatsApp(order).catch(() => {});
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
    .where(and(
      eq(ordersTable.source, "online"),
      or(gte(ordersTable.createdAt, since), gte(ordersTable.updatedAt, since)),
      // Exclude card/ATH Móvil orders that haven't been paid yet.
      // This means they never enter the mini PC's local DB while pending.
      // When payment is confirmed (paymentStatus → paid), updatedAt changes and
      // the order appears in the next sync cycle as a brand-new record — the
      // existing INSERT path handles it with no local code change needed.
      or(notInArray(ordersTable.paymentMethod, ["card", "athmovil"]), ne(ordersTable.paymentStatus, "pending")),
    ))
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

// Sync payment events down to the mini PC.
// PlaceToPay payment events are only ever created in the cloud (their webhook can
// only reach a public URL — the mini PC sits on a private LAN). The mini PC pulls
// them here so the LOCAL admin's payment-events log matches the cloud.
// Protected by the shared SYNC_SECRET bearer token.
router.get("/orders/payment-events-sync", async (req, res): Promise<void> => {
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

  // Left-join orders so we can send the confirmation code (stable across cloud &
  // mini PC). The numeric order_id differs between the two databases and must NOT
  // be copied down — the mini PC re-resolves it from the confirmation code.
  const rows = await db
    .select({
      requestId:  paymentEventsTable.requestId,
      joinedRef:  ordersTable.confirmationCode,
      storedRef:  paymentEventsTable.orderRef,
      event:      paymentEventsTable.event,
      rawStatus:  paymentEventsTable.rawStatus,
      sigPresent: paymentEventsTable.sigPresent,
      sigValid:   paymentEventsTable.sigValid,
      notes:      paymentEventsTable.notes,
      createdAt:  paymentEventsTable.createdAt,
    })
    .from(paymentEventsTable)
    .leftJoin(ordersTable, eq(paymentEventsTable.orderId, ordersTable.id))
    .where(gte(paymentEventsTable.createdAt, since))
    .orderBy(paymentEventsTable.createdAt);

  const result = rows.map((r) => ({
    requestId:  r.requestId,
    orderRef:   r.joinedRef ?? r.storedRef ?? null,
    event:      r.event,
    rawStatus:  r.rawStatus,
    sigPresent: r.sigPresent,
    sigValid:   r.sigValid,
    notes:      r.notes,
    createdAt:  r.createdAt,
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
          logger.error({ err: err?.message }, "[email] ready notification failed")
        );
      }
      if (order.customerPhone) {
        sendReadySMS(order).catch((err) =>
          logger.error({ err: err?.message }, "[sms] ready notification failed")
        );
        sendOrderReadyWhatsApp(order).catch((err) =>
          logger.error({ err: err?.message }, "[whatsapp] ready notification failed")
        );
      }
    }
    if (
      parsed.data.status === "cancelled" &&
      (order.source === "phone" || order.source === "online") &&
      order.customerPhone
    ) {
      sendCancellationSMS(order, parsed.data.cancellationReason ?? null).catch((err) =>
        logger.error({ err: err?.message }, "[sms] cancellation notification failed")
      );
      sendOrderCancelledWhatsApp(order).catch((err) =>
        logger.error({ err: err?.message }, "[whatsapp] cancellation notification failed")
      );
    }
  }

  broadcastOrderEvent("order_updated", order.id);
  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

/**
 * Mark a subset of an order's items as already made.
 *
 * Used by the KDS ADD-ON card flow: when staff add items to an order that the
 * kitchen has already started preparing, the new items render as a SEPARATE
 * "ADD-ON" card on the KDS. Tapping "Made ✓" on that card calls this endpoint
 * with the IDs of the new items, marking them alreadyMade=true. This does NOT
 * advance the order's overall status — the original items may still be in
 * "preparing".
 */
router.post("/orders/:id/items/mark-made", requireStaffAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = req.body as { itemIds?: unknown };
  const itemIds = Array.isArray(body.itemIds)
    ? body.itemIds.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : null;
  if (!itemIds || itemIds.length === 0) {
    res.status(400).json({ error: "itemIds must be a non-empty array of integers" });
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

  // Scope the update to this order's items only — defense against a client
  // accidentally (or maliciously) marking items on a different order.
  await db
    .update(orderItemsTable)
    .set({ alreadyMade: true })
    .where(and(
      eq(orderItemsTable.orderId, order.id),
      inArray(orderItemsTable.id, itemIds),
    ));

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  broadcastOrderEvent("order_updated", order.id);
  res.json(formatOrder(order as unknown as Record<string, unknown>, items as unknown as Record<string, unknown>[]));
});

/**
 * Append new items to an existing order without cancelling/recreating it.
 *
 * Used by the POS when a customer adds items to a held or in-progress ticket.
 * Existing items keep their alreadyMade flag; new items are inserted with alreadyMade=false.
 * The order subtotal and total are recalculated to reflect the additions.
 *
 * This replaces the cancel+recreate pattern for the "add-on only" case, which was
 * causing (1) the order to disappear from the KDS when only a drink was added and
 * (2) items in "Preparing" to jump back to the "Accept" column.
 */
router.post("/orders/:id/add-items", requireStaffAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = CreateOrderBody.shape.items.safeParse(
    Array.isArray((req.body as { items?: unknown }).items) ? (req.body as { items: unknown[] }).items : null
  );
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.length === 0) { res.status(400).json({ error: "Must supply at least one item" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status === "cancelled") { res.status(400).json({ error: "Cannot add items to a cancelled order" }); return; }

  // Validate + price each new item (same logic as order creation)
  const nonNullIds = parsed.data.map((i) => i.menuItemId).filter((id): id is number => id != null);
  const menuItems = nonNullIds.length > 0
    ? await db.select().from(menuItemsTable).where(
        nonNullIds.length === 1 ? eq(menuItemsTable.id, nonNullIds[0]) : inArray(menuItemsTable.id, nonNullIds)
      )
    : [];
  const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

  type ModifierSelection = { modifierId: string; optionId: string; name: string; price: number };
  let addedSubtotal = 0;
  const newItemsData: {
    menuItemId: number | null; menuItemName: string; menuItemPrice: string;
    quantity: number; notes: string | null; modifierSelections: ModifierSelection[] | null;
    alreadyMade: boolean; subtotal: string;
  }[] = [];

  for (const item of parsed.data) {
    let itemName: string;
    let price: number;
    if (item.menuItemId == null) {
      if (!item.menuItemName || typeof item.menuItemPrice !== "number") {
        res.status(400).json({ error: "Deleted menu item must supply menuItemName and menuItemPrice" }); return;
      }
      itemName = item.menuItemName;
      price = item.menuItemPrice;
    } else {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) { res.status(400).json({ error: `Menu item ${item.menuItemId} not found` }); return; }
      if (!menuItem.available) { res.status(400).json({ error: `Menu item "${menuItem.name}" is not available` }); return; }
      if (menuItem.openPrice) {
        const override = item.priceOverride;
        if (typeof override !== "number" || !Number.isFinite(override) || override <= 0) {
          res.status(400).json({ error: `"${menuItem.name}" requires a price greater than 0` }); return;
        }
        price = override;
      } else {
        price = parseFloat(menuItem.price as unknown as string);
      }
      itemName = menuItem.name;
    }
    const modifierTotal = (item.modifierSelections ?? []).reduce((s: number, m: { price?: number }) => s + (m.price ?? 0), 0);
    const itemSubtotal = (price + modifierTotal) * item.quantity;
    addedSubtotal += itemSubtotal;
    newItemsData.push({
      menuItemId: item.menuItemId ?? null,
      menuItemName: itemName,
      menuItemPrice: String(price),
      quantity: item.quantity,
      notes: item.notes ?? null,
      modifierSelections: item.modifierSelections ?? null,
      alreadyMade: false,
      subtotal: String(itemSubtotal),
    });
  }

  // If the kitchen has already started this order AND the new batch includes at least
  // one KDS item, mark existing items as alreadyMade so the KDS addon-card split fires:
  // new KDS items get their own "Accept" card while the original items stay put.
  //
  // Critically: skip the marking when only non-KDS items (drinks) are being added.
  // sendToKds lives on the CATEGORY (not the item). Fetch category flags for the new
  // items' categories to determine if any of them are KDS items.
  // Marking existing food as alreadyMade=true then adding only a drink (whose category
  // has sendToKds=false) would leave zero items passing the KDS filter → order disappears.
  const newItemCategoryIds = [...new Set(
    parsed.data
      .map(item => item.menuItemId != null ? menuItemMap.get(item.menuItemId)?.categoryId : null)
      .filter((id): id is number => id != null)
  )];
  const newItemCategories = newItemCategoryIds.length > 0
    ? await db.select({ id: menuCategoriesTable.id, sendToKds: menuCategoriesTable.sendToKds })
        .from(menuCategoriesTable)
        .where(newItemCategoryIds.length === 1
          ? eq(menuCategoriesTable.id, newItemCategoryIds[0])
          : inArray(menuCategoriesTable.id, newItemCategoryIds))
    : [];
  const categoryKdsMap = new Map(newItemCategories.map(c => [c.id, c.sendToKds]));
  const hasNewKdsItem = parsed.data.some(item => {
    if (item.menuItemId == null) return true; // deleted-item fallback: assume KDS
    const categoryId = menuItemMap.get(item.menuItemId)?.categoryId;
    if (categoryId == null) return true;
    return categoryKdsMap.get(categoryId) !== false;
  });

  if (hasNewKdsItem && (order.status === "preparing" || order.status === "ready")) {
    await db
      .update(orderItemsTable)
      .set({ alreadyMade: true })
      .where(and(
        eq(orderItemsTable.orderId, order.id),
        eq(orderItemsTable.alreadyMade, false),
      ));
  }

  await db.insert(orderItemsTable).values(newItemsData.map(d => ({ ...d, orderId: order.id })));

  // Recalculate order totals
  const oldSubtotal = parseFloat(order.subtotal as unknown as string);
  const discount = parseFloat((order.discountAmount ?? "0") as unknown as string);
  const newSubtotal = oldSubtotal + addedSubtotal;
  const newSubtotalAfterDiscount = Math.max(0, newSubtotal - discount);
  const newTax = Math.round(newSubtotalAfterDiscount * TAX_RATE * 100) / 100;
  const newTotal = Math.round((newSubtotalAfterDiscount + newTax) * 100) / 100;

  const [updatedOrder] = await db
    .update(ordersTable)
    .set({ subtotal: String(newSubtotal), tax: String(newTax), total: String(newTotal) })
    .where(eq(ordersTable.id, order.id))
    .returning();

  const allItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));

  broadcastOrderEvent("order_updated", order.id);
  res.json(formatOrder(updatedOrder as unknown as Record<string, unknown>, allItems as unknown as Record<string, unknown>[]));
});

router.post("/orders/:id/refund", requireStaffAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { amount, reason, refundMethod = "cash" } = req.body as { amount: number; reason?: string; refundMethod?: string };
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount required" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Cedar Cafe does not use PlaceToPay — card refunds are always manual.
  const ptpReversed = false;
  const ptpMessage: string | undefined = undefined;

  const [refund] = await db.insert(refundsTable).values({
    orderId: id,
    amount: String(amount),
    reason: reason ?? null,
    refundMethod: order.paymentMethod === "card" ? "card" : refundMethod,
  }).returning();
  await db.update(ordersTable).set({ paymentStatus: "refunded" }).where(eq(ordersTable.id, id));
  res.status(201).json({
    ...refund,
    amount: parseFloat(refund.amount),
    ptpReversed,
    ...(ptpMessage ? { ptpMessage } : {}),
  });
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

  const storeForEmail = await getStoreSettings().catch(() => ({ storeName: "Cedar Cafe", address: "", email: "" } as Awaited<ReturnType<typeof getStoreSettings>>));

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Receipt #${order.confirmationCode}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#1a1f36;padding:28px 32px;text-align:center">
          <div style="color:#f5a623;font-size:26px;font-weight:800;letter-spacing:1px">☕ ${storeForEmail.storeName.toUpperCase()}</div>
          ${storeForEmail.address ? `<div style="color:#aaa;font-size:13px;margin-top:4px">${storeForEmail.address}</div>` : ""}
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
          ${storeForEmail.email ? `<div style="color:#bbb;font-size:12px;margin-top:4px">${storeForEmail.email}</div>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM ?? `${storeForEmail.storeName} <${storeForEmail.email || "no-reply@example.com"}>`,
      to: recipient,
      subject: `Your ${storeForEmail.storeName} Receipt — Order #${order.confirmationCode}`,
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

// GET /api/orders/receipt/:code
// Public endpoint — generates and streams a PDF receipt for the given
// confirmation code. No auth required (the code itself is semi-secret).
// Meta fetches this URL directly when delivering the WhatsApp receipt template.
router.get("/orders/receipt/:code", async (req, res): Promise<void> => {
  const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  // Strip a trailing .pdf extension so both /receipt/IT-1234 and /receipt/IT-1234.pdf work
  const code = rawCode.replace(/\.pdf$/i, "");

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.confirmationCode, code));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const store = await getStoreSettings();
  const pdfBuffer = await buildReceiptPdf({
    confirmationCode: order.confirmationCode,
    customerName:     order.customerName,
    createdAt:        order.createdAt,
    paymentMethod:    order.paymentMethod,
    subtotal:         String(order.subtotal),
    discountAmount:   String(order.discountAmount ?? "0"),
    total:            String(order.total),
    storeEmail:       store.email   || undefined,
    storeName:        store.storeName || undefined,
    storeAddress:     store.address || undefined,
    items: items.map((item) => ({
      name:      item.menuItemName,
      quantity:  item.quantity ?? 1,
      unitPrice: String(item.menuItemPrice),
      subtotal:  String(item.subtotal),
      modifiers: (item.modifierSelections ?? []).map((m) => ({ name: m.name, price: m.price })),
      notes:     item.notes,
    })),
  });

  res.setHeader("Content-Type", "application/pdf");
  const safeName = (store.storeName ?? "Receipt").replace(/[^a-zA-Z0-9]/g, "-");
  res.setHeader("Content-Disposition", `inline; filename="${safeName}-Receipt-${order.confirmationCode}.pdf"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(pdfBuffer);
});

// POST /api/orders/:id/whatsapp-receipt
// Sends a WhatsApp receipt template (island_tacos_order_receipt) with a PDF
// attachment. Meta fetches the PDF from GET /api/orders/receipt/:code at
// delivery time — no upload needed.
router.post("/orders/:id/whatsapp-receipt", requireStaffAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid order ID" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ ok: false, error: "Order not found" });
    return;
  }
  if (!order.customerPhone) {
    res.status(400).json({ ok: false, error: "Order has no phone number" });
    return;
  }

  try {
    const ok = await sendOrderReceiptWhatsApp({
      customerPhone:    normalizePhoneForWhatsApp(order.customerPhone),
      customerName:     order.customerName,
      confirmationCode: order.confirmationCode,
    });

    if (ok) {
      res.json({ ok: true });
    } else {
      // ok===false means env vars missing (META_PHONE_NUMBER_ID / META_ACCESS_TOKEN)
      res.status(502).json({ ok: false, error: "WhatsApp not configured — META_PHONE_NUMBER_ID or META_ACCESS_TOKEN missing" });
    }
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      req.log.error({ metaStatus: err.status, metaBody: err.metaBody }, "[whatsapp] receipt send rejected by Meta");
      res.status(502).json({ ok: false, error: err.message, metaBody: err.metaBody });
    } else {
      req.log.error({ err }, "[whatsapp] receipt send unexpected error");
      res.status(502).json({ ok: false, error: "WhatsApp receipt send failed — unexpected error" });
    }
  }
});

export default router;

