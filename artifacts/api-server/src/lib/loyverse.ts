import { db } from "@workspace/db";
import { menuCategoriesTable, menuItemsTable, modifiersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const LOYVERSE_API = "https://api.loyverse.com/v1.0";
const STORE_ID = "fa2b85a6-711d-11ea-8d93-0603130a05b8";
const EMPLOYEE_ID = "324dd4ee-71a9-11ea-8d93-0603130a05b8";

function getToken() {
  const token = process.env.LOYVERSE_API_TOKEN;
  if (!token) throw new Error("LOYVERSE_API_TOKEN not set");
  return token;
}

async function loyverseFetch<T = Record<string, unknown>>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${LOYVERSE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Loyverse API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface LoyverseCategory {
  id: string;
  name: string;
  color: string;
  deleted_at: string | null;
}

export interface LoyverseModifierOption {
  id: string;
  name: string;
  price: number;
  position: number;
}

export interface LoyverseModifier {
  id: string;
  name: string;
  modifier_options: LoyverseModifierOption[];
  deleted_at: string | null;
}

export interface LoyverseVariant {
  variant_id: string;
  item_id: string;
  sku: string;
  default_price: number;
  stores: { store_id: string; price: number; available_for_sale: boolean }[];
}

export interface LoyverseItem {
  id: string;
  item_name: string;
  description: string | null;
  category_id: string | null;
  image_url: string | null;
  modifier_ids: string[];
  variants: LoyverseVariant[];
  deleted_at: string | null;
}

export async function fetchLoyverseCategories(): Promise<LoyverseCategory[]> {
  const data = await loyverseFetch<{ categories: LoyverseCategory[] }>("/categories");
  return (data.categories ?? []).filter((c) => !c.deleted_at);
}

export async function fetchLoyverseItems(): Promise<LoyverseItem[]> {
  const all: LoyverseItem[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "250" });
    if (cursor) params.set("cursor", cursor);
    const data = await loyverseFetch<{ items: LoyverseItem[]; cursor?: string }>(`/items?${params}`);
    all.push(...(data.items ?? []));
    cursor = data.cursor;
  } while (cursor);
  return all.filter((i) => !i.deleted_at);
}

export async function fetchLoyverseModifiers(): Promise<LoyverseModifier[]> {
  const data = await loyverseFetch<{ modifiers: LoyverseModifier[] }>("/modifiers?limit=250");
  return (data.modifiers ?? []).filter((m) => !m.deleted_at);
}

export interface SyncResult {
  categoriesUpserted: number;
  itemsUpserted: number;
  itemsSkipped: number;
  modifiers: number;
  errors: string[];
}

export async function syncFromLoyverse(): Promise<SyncResult> {
  const result: SyncResult = {
    categoriesUpserted: 0,
    itemsUpserted: 0,
    itemsSkipped: 0,
    modifiers: 0,
    errors: [],
  };

  const [loyverseCategories, loyverseItems, loyverseModifiers] =
    await Promise.all([
      fetchLoyverseCategories(),
      fetchLoyverseItems(),
      fetchLoyverseModifiers(),
    ]);

  result.modifiers = loyverseModifiers.length;

  // Upsert modifiers into the local DB
  for (const lmod of loyverseModifiers) {
    try {
      const options = (lmod.modifier_options ?? [])
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ id: o.id, name: o.name, price: o.price, position: o.position }));

      const existing = await db.query.modifiersTable.findFirst({
        where: eq(modifiersTable.loyverseId, lmod.id),
      });
      if (existing) {
        await db.update(modifiersTable).set({ name: lmod.name, options }).where(eq(modifiersTable.id, existing.id));
      } else {
        await db.insert(modifiersTable).values({ loyverseId: lmod.id, name: lmod.name, options });
      }
    } catch (err) {
      result.errors.push(`Modifier ${lmod.name}: ${err}`);
    }
  }

  // Build a map: loyverse category id → local db id
  const catIdMap = new Map<string, number>();

  for (let i = 0; i < loyverseCategories.length; i++) {
    const lcat = loyverseCategories[i];
    try {
      const existing = await db.query.menuCategoriesTable.findFirst({
        where: eq(menuCategoriesTable.loyverseId, lcat.id),
      });

      if (existing) {
        await db
          .update(menuCategoriesTable)
          .set({ name: lcat.name })
          .where(eq(menuCategoriesTable.id, existing.id));
        catIdMap.set(lcat.id, existing.id);
      } else {
        const [created] = await db
          .insert(menuCategoriesTable)
          .values({
            name: lcat.name,
            loyverseId: lcat.id,
            sortOrder: i,
          })
          .returning();
        catIdMap.set(lcat.id, created.id);
      }
      result.categoriesUpserted++;
    } catch (err) {
      result.errors.push(`Category ${lcat.name}: ${err}`);
    }
  }

  // Strip HTML from descriptions
  function stripHtml(html: string | null): string | null {
    if (!html) return null;
    return html.replace(/<[^>]+>/g, "").trim() || null;
  }

  for (const litem of loyverseItems) {
    try {
      if (!litem.item_name?.trim()) {
        result.itemsSkipped++;
        continue;
      }

      // Find the primary variant (first one, or store-specific price)
      const variant = litem.variants[0];
      if (!variant) {
        result.itemsSkipped++;
        continue;
      }

      const storeVariant = variant.stores.find((s) => s.store_id === STORE_ID);
      const price = storeVariant?.price ?? variant.default_price ?? 0;
      const available = storeVariant?.available_for_sale ?? true;

      // Find or create category
      let categoryId: number | null = litem.category_id
        ? (catIdMap.get(litem.category_id) ?? null)
        : null;

      // Fall back to first category if none mapped
      if (!categoryId) {
        const fallback = await db.query.menuCategoriesTable.findFirst();
        categoryId = fallback?.id ?? null;
      }

      if (!categoryId) {
        result.itemsSkipped++;
        continue;
      }

      const existing = await db.query.menuItemsTable.findFirst({
        where: eq(menuItemsTable.loyverseItemId, litem.id),
      });

      if (existing) {
        // Update everything except `available` — preserve the admin's visibility toggle
        await db
          .update(menuItemsTable)
          .set({
            name: litem.item_name,
            description: stripHtml(litem.description),
            price: String(price),
            imageUrl: litem.image_url ?? null,
            categoryId,
            loyverseItemId: litem.id,
            loyverseVariantId: variant.variant_id,
            loyverseModifierIds: litem.modifier_ids,
          })
          .where(eq(menuItemsTable.id, existing.id));
      } else {
        // New item — use Loyverse's available_for_sale as the initial state
        await db.insert(menuItemsTable).values({
          name: litem.item_name,
          description: stripHtml(litem.description),
          price: String(price),
          imageUrl: litem.image_url ?? null,
          available,
          categoryId,
          loyverseItemId: litem.id,
          loyverseVariantId: variant.variant_id,
          loyverseModifierIds: litem.modifier_ids,
        });
      }
      result.itemsUpserted++;
    } catch (err) {
      result.errors.push(`Item ${litem.item_name}: ${err}`);
    }
  }

  return result;
}

export interface LoyversePaymentType {
  id: string;
  name: string;
  type: string;
}

let _paymentTypesCache: LoyversePaymentType[] | null = null;

async function getPaymentTypes(): Promise<LoyversePaymentType[]> {
  if (_paymentTypesCache) return _paymentTypesCache;
  const data = await loyverseFetch<{ payment_types: LoyversePaymentType[] }>("/payment_types");
  _paymentTypesCache = data.payment_types ?? [];
  return _paymentTypesCache;
}

async function resolvePaymentTypeId(paymentMethod: string): Promise<string | null> {
  try {
    const types = await getPaymentTypes();
    if (!types.length) return null;

    const method = paymentMethod.toLowerCase();
    const keywords: Record<string, string[]> = {
      card: ["credit", "card", "visa", "master"],
      card_bppr: ["credit", "card", "visa", "master"],
      athmovil: ["ath", "móvil", "movil"],
      cash: ["cash", "efectivo"],
    };

    const candidates = keywords[method] ?? [method];
    for (const kw of candidates) {
      const match = types.find((t) => t.name.toLowerCase().includes(kw));
      if (match) return match.id;
    }

    return types[0].id;
  } catch {
    return null;
  }
}

export interface ModifierSelection {
  modifierId: string;
  optionId: string;
  name: string;
  price: number;
}

export interface OrderForReceipt {
  id: number;
  customerName: string;
  customerPhone: string;
  confirmationCode: string;
  notes: string | null;
  total: number;
  paymentMethod: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    notes: string | null;
    modifierSelections: ModifierSelection[] | null;
    loyverseItemId: string | null;
    loyverseVariantId: string | null;
  }[];
}

export async function pushOrderToLoyverse(order: OrderForReceipt): Promise<string> {
  const lineItems: Record<string, unknown>[] = [];

  for (const item of order.items) {
    // Roll modifier prices into the item price — Loyverse requires variant_id on every line item,
    // and modifiers are not catalog items so they have no variant_id. Instead, modifier names
    // appear in the note field which Loyverse displays on the receipt.
    const modTotal = (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0);
    const linePrice = Math.round((item.price + modTotal) * 100) / 100;

    const base: Record<string, unknown> = {
      item_name: item.name,
      quantity: item.quantity,
      price: linePrice,
      gross_total_money: Math.round(linePrice * item.quantity * 100) / 100,
      total_money: Math.round(linePrice * item.quantity * 100) / 100,
    };
    // variant_id links the line item to the Loyverse catalog (required for catalog items)
    if (item.loyverseVariantId) base.variant_id = item.loyverseVariantId;
    if (item.notes) base.note = item.notes;
    lineItems.push(base);
  }

  const paymentTypeId = await resolvePaymentTypeId(order.paymentMethod);

  // Use sum of line items as payment amount — guarantees Loyverse won't reject due to mismatch
  const lineItemsTotal = Math.round(
    lineItems.reduce((s, li) => s + (li.total_money as number), 0) * 100
  ) / 100;

  const payments = paymentTypeId
    ? [{ payment_type_id: paymentTypeId, money_amount: lineItemsTotal }]
    : [];

  const body: Record<string, unknown> = {
    store_id: STORE_ID,
    employee_id: EMPLOYEE_ID,
    receipt_type: "SALE",
    receipt_date: new Date().toISOString(),
    note: `#${order.confirmationCode} — ${order.customerName} · ${order.customerPhone}${order.notes ? ` | ${order.notes}` : ""}`,
    line_items: lineItems,
    payments,
  };

  const data = await loyverseFetch<{ receipt_number: string }>("/receipts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.receipt_number;
}
