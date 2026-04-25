import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray, count, or } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, menuCategoriesTable, modifiersTable, storeSettingsTable } from "@workspace/db";
import { SETTING_DEFAULTS, computeStoreStatus } from "./settings";

const router: IRouter = Router();

function getVapiSecret(): string | undefined {
  return process.env.VAPI_WEBHOOK_SECRET;
}

type SecretCheckResult = "ok" | "missing_secret_config" | "invalid_secret";

function checkVapiSecret(req: Request): SecretCheckResult {
  const secret = getVapiSecret();
  if (!secret) return "missing_secret_config";
  const authHeader = req.headers["authorization"];
  const secretHeader = req.headers["x-vapi-secret"];
  if (authHeader && authHeader === `Bearer ${secret}`) return "ok";
  if (secretHeader && secretHeader === secret) return "ok";
  return "invalid_secret";
}

function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "IT";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface VapiModifierSelection {
  modifierId: string;
  optionId: string;
  name: string;
  price: number;
}

interface VapiOrderItem {
  menuItemId: number;
  quantity?: number;
  notes?: string | null;
  modifierSelections?: VapiModifierSelection[];
}

interface VapiOrderPayload {
  customerName: string;
  customerPhone: string;
  notes?: string | null;
  items: VapiOrderItem[];
}

function validateVapiOrder(body: unknown): { data: VapiOrderPayload } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };
  const b = body as Record<string, unknown>;
  if (!b.customerName || typeof b.customerName !== "string" || !b.customerName.trim()) return { error: "customerName is required" };
  if (!b.customerPhone || typeof b.customerPhone !== "string" || !b.customerPhone.trim()) return { error: "customerPhone is required" };
  if (!Array.isArray(b.items) || b.items.length === 0) return { error: "items must be a non-empty array" };
  for (const item of b.items) {
    if (!item || typeof item !== "object") return { error: "Each item must be an object" };
    const i = item as Record<string, unknown>;
    if (!i.menuItemId || typeof i.menuItemId !== "number") return { error: "Each item must have a numeric menuItemId" };
    if (i.quantity !== undefined && (typeof i.quantity !== "number" || i.quantity < 1)) return { error: "quantity must be a positive integer" };
  }
  return {
    data: {
      customerName: (b.customerName as string).trim(),
      customerPhone: (b.customerPhone as string).trim(),
      notes: typeof b.notes === "string" ? b.notes : null,
      items: (b.items as Record<string, unknown>[]).map(i => ({
        menuItemId: i.menuItemId as number,
        quantity: typeof i.quantity === "number" ? Math.max(1, Math.round(i.quantity)) : 1,
        notes: typeof i.notes === "string" ? i.notes : null,
        modifierSelections: Array.isArray(i.modifierSelections)
          ? (i.modifierSelections as Record<string, unknown>[]).map(m => ({
              modifierId: String(m.modifierId ?? ""),
              optionId: String(m.optionId ?? ""),
              name: String(m.name ?? ""),
              price: typeof m.price === "number" ? m.price : 0,
            }))
          : undefined,
      })),
    },
  };
}

router.all("/vapi/menu", async (req: Request, res: Response): Promise<void> => {
  console.log(`[vapi/menu] ${req.method} called`);
  try {
    const [categories, items, modifiers] = await Promise.all([
      db.select().from(menuCategoriesTable).orderBy(menuCategoriesTable.sortOrder),
      db.select().from(menuItemsTable).orderBy(menuItemsTable.sortOrder),
      db.select().from(modifiersTable),
    ]);

    const modifierMap = new Map(modifiers.map(m => [m.loyverseId, m]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const menuData = items.map(item => {
      const itemModifiers = (item.loyverseModifierIds ?? [])
        .map(id => modifierMap.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map(m => ({
          name: m.name,
          required: m.required,
          options: (m.options as { id: string; name: string; price: number }[]).map(o => ({
            id: o.id,
            name: o.name,
            price: o.price,
          })),
        }));

      return {
        id: item.id,
        name: item.name,
        category: categoryMap.get(item.categoryId) ?? "Other",
        price: parseFloat(item.price as unknown as string),
        available: item.available,
        modifiers: itemModifiers,
      };
    });

    const payload = {
      restaurantName: "Island Tacos",
      currency: "USD",
      menu: menuData,
    };

    console.log(`[vapi/menu] returning ${menuData.length} items, payload size ~${JSON.stringify(payload).length} bytes`);
    res.json({ result: JSON.stringify(payload) });
  } catch (err) {
    console.error("[vapi/menu] error:", err);
    res.status(500).json({ error: "Failed to load menu" });
  }
});

router.post("/vapi/order", async (req: Request, res: Response): Promise<void> => {
  const secretCheck = checkVapiSecret(req);
  if (secretCheck === "missing_secret_config") {
    res.status(503).json({ error: "Webhook secret not configured. Set VAPI_WEBHOOK_SECRET environment variable." });
    return;
  }
  if (secretCheck === "invalid_secret") {
    res.status(401).json({ error: "Unauthorized: invalid or missing webhook secret" });
    return;
  }

  const validation = validateVapiOrder(req.body);
  if ("error" in validation) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { customerName, customerPhone, notes, items } = validation.data;

  const settingRows = await db.select().from(storeSettingsTable);
  const settings: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of settingRows) settings[row.key] = row.value;
  const { is_open } = computeStoreStatus(settings);
  if (!is_open) {
    const [ch, cm] = (settings.open_time ?? "11:00").split(":").map(Number);
    const ampm = ch >= 12 ? "PM" : "AM";
    const hour = ch % 12 || 12;
    const opensAt = `${hour}:${String(cm).padStart(2, "0")} ${ampm}`;
    res.status(403).json({
      error: `We're not accepting orders right now. We open at ${opensAt} AST.`,
      code: "CLOSED",
    });
    return;
  }

  const menuItemIds = items.map(i => i.menuItemId);
  const menuItems = await db
    .select()
    .from(menuItemsTable)
    .where(menuItemIds.length === 1
      ? eq(menuItemsTable.id, menuItemIds[0])
      : inArray(menuItemsTable.id, menuItemIds)
    );

  const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

  let subtotal = 0;
  const orderItemsData: {
    menuItemId: number;
    menuItemName: string;
    menuItemPrice: number;
    quantity: number;
    notes: string | null;
    modifierSelections: VapiModifierSelection[] | null;
    itemSubtotal: number;
  }[] = [];

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) {
      res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      return;
    }
    if (!menuItem.available) {
      res.status(400).json({ error: `"${menuItem.name}" is not available right now` });
      return;
    }
    const price = parseFloat(menuItem.price as unknown as string);
    const modifierTotal = (item.modifierSelections ?? []).reduce((s, m) => s + (m.price ?? 0), 0);
    const qty = item.quantity ?? 1;
    const itemSubtotal = (price + modifierTotal) * qty;
    subtotal += itemSubtotal;
    orderItemsData.push({
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
      menuItemPrice: price,
      quantity: qty,
      notes: item.notes ?? null,
      modifierSelections: item.modifierSelections ?? null,
      itemSubtotal,
    });
  }

  const tax = 0;
  const deliveryFee = 0;
  const total = Math.round((subtotal + tax + deliveryFee) * 100) / 100;
  const confirmationCode = generateConfirmationCode();

  const BASE_MINS = 10;
  const MINS_PER_ORDER = 5;
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
  const estimatedMinutes = BASE_MINS + Number(activeOrderCount) * MINS_PER_ORDER;
  const estimatedReadyAt = new Date(Date.now() + estimatedMinutes * 60 * 1000);

  const [order] = await db
    .insert(ordersTable)
    .values({
      confirmationCode,
      customerName,
      customerEmail: "",
      customerPhone,
      orderType: "pickup",
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "cash",
      source: "phone",
      subtotal: String(subtotal),
      discountAmount: "0",
      tax: String(tax),
      deliveryFee: String(deliveryFee),
      total: String(total),
      notes: notes ?? null,
      estimatedReadyAt,
    })
    .returning();

  await db
    .insert(orderItemsTable)
    .values(
      orderItemsData.map(item => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        menuItemPrice: String(item.menuItemPrice),
        quantity: item.quantity,
        notes: item.notes,
        modifierSelections: item.modifierSelections ?? null,
        alreadyMade: false,
        subtotal: String(item.itemSubtotal),
      }))
    );

  const estimatedTimeStr = estimatedReadyAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  });

  console.log(`[vapi/order] Phone order created: ${confirmationCode} for ${customerName} (${customerPhone})`);

  res.status(201).json({
    result: JSON.stringify({
      success: true,
      confirmationCode,
      total,
      estimatedMinutes,
      estimatedReadyAt: estimatedReadyAt.toISOString(),
      estimatedReadyAtFormatted: estimatedTimeStr,
      message: `Order placed! Confirmation code: ${confirmationCode}. Ready in about ${estimatedMinutes} minutes around ${estimatedTimeStr}. Pay at pickup.`,
    }),
  });
});

export default router;
