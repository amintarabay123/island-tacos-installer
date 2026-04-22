import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { proxyImageUrl, prewarmImageCache } from "./image-proxy";
import { db, menuCategoriesTable, menuItemsTable, modifiersTable, orderItemsTable } from "@workspace/db";
import {
  CreateMenuCategoryBody,
  UpdateMenuCategoryParams,
  UpdateMenuCategoryBody,
  DeleteMenuCategoryParams,
  ListMenuItemsQueryParams,
  CreateMenuItemBody,
  GetMenuItemParams,
  UpdateMenuItemParams,
  UpdateMenuItemBody,
  DeleteMenuItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ---- Categories ----

router.get("/menu/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({ category: menuCategoriesTable })
    .from(menuCategoriesTable)
    .innerJoin(
      menuItemsTable,
      eq(menuItemsTable.categoryId, menuCategoriesTable.id)
    )
    .where(sql`${menuItemsTable.available} = true`)
    .groupBy(menuCategoriesTable.id)
    .orderBy(menuCategoriesTable.sortOrder);
  res.json(categories.map((r) => r.category));
});

router.post("/menu/categories", async (req, res): Promise<void> => {
  const parsed = CreateMenuCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db
    .insert(menuCategoriesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();
  res.status(201).json(category);
});

router.patch("/menu/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateMenuCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMenuCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.sendToKds !== undefined) updates.sendToKds = parsed.data.sendToKds;
  if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon ?? null;

  const [updated] = await db
    .update(menuCategoriesTable)
    .set(updates)
    .where(eq(menuCategoriesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(updated);
});

router.delete("/menu/categories/:id", async (req, res): Promise<void> => {
  const params = DeleteMenuCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(menuCategoriesTable)
    .where(eq(menuCategoriesTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.sendStatus(204);
});

// ---- Menu Items ----

router.get("/menu/items", async (req, res): Promise<void> => {
  const queryParsed = ListMenuItemsQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  let query = db.select().from(menuItemsTable).orderBy(menuItemsTable.sortOrder, menuItemsTable.id).$dynamic();
  if (queryParsed.data.categoryId !== undefined) {
    query = query.where(eq(menuItemsTable.categoryId, queryParsed.data.categoryId));
  }
  if (queryParsed.data.available !== undefined) {
    query = query.where(eq(menuItemsTable.available, queryParsed.data.available));
  }
  const items = await query;
  // Pre-warm image cache so all Loyverse images are ready before the browser asks
  prewarmImageCache(items.flatMap(i => [i.imageUrl, i.posImageUrl]));
  const result = items.map((item) => ({
    ...item,
    price: parseFloat(item.price as unknown as string),
    imageUrl: proxyImageUrl(item.imageUrl),
    posImageUrl: proxyImageUrl(item.posImageUrl),
  }));
  res.json(result);
});

// ---- Top sellers (based on real order data) ----
// Returns up to `limit` available items ordered by total units sold.
// Falls back gracefully to an empty array if there are no sales yet.
router.get("/menu/popular", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "5")), 20);
  // Optional rolling window filter via ?days=30
  const days = req.query.days ? parseInt(String(req.query.days)) : null;

  const rows = await db.execute(sql`
    SELECT
      mi.id,
      mi.name,
      mi.description,
      mi.price,
      mi.image_url      AS "imageUrl",
      mi.pos_image_url  AS "posImageUrl",
      mi.available,
      mi.popular,
      mi.spicy,
      mi.vegetarian,
      mi.sort_order     AS "sortOrder",
      mi.category_id    AS "categoryId",
      SUM(oi.quantity)::int AS "totalSold"
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE mi.available = true
      AND oi.menu_item_id IS NOT NULL
      ${days ? sql`AND o.created_at >= NOW() - (${days} || ' days')::interval` : sql``}
    GROUP BY mi.id
    ORDER BY "totalSold" DESC
    LIMIT ${limit}
  `);

  res.json(
    rows.rows.map((r) => ({
      ...r,
      price: parseFloat(r.price as string),
      imageUrl: proxyImageUrl(r.imageUrl as string | null),
      posImageUrl: proxyImageUrl(r.posImageUrl as string | null),
    }))
  );
});

router.post("/menu/items", async (req, res): Promise<void> => {
  const parsed = CreateMenuItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .insert(menuItemsTable)
    .values({
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: String(parsed.data.price),
      imageUrl: parsed.data.imageUrl ?? null,
      posImageUrl: parsed.data.posImageUrl ?? null,
      available: parsed.data.available ?? true,
      popular: parsed.data.popular ?? false,
      spicy: parsed.data.spicy ?? false,
      vegetarian: parsed.data.vegetarian ?? false,
    })
    .returning();
  res.status(201).json({ ...item, price: parseFloat(item.price as unknown as string) });
});

router.get("/menu/items/:id", async (req, res): Promise<void> => {
  const params = GetMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, params.data.id));
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json({ ...item, price: parseFloat(item.price as unknown as string), imageUrl: proxyImageUrl(item.imageUrl), posImageUrl: proxyImageUrl(item.posImageUrl) });
});

router.get("/menu/items/:id/modifiers", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [item] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, id));
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  const modifierIds = item.loyverseModifierIds ?? [];
  if (modifierIds.length === 0) { res.json([]); return; }

  const mods = await db
    .select()
    .from(modifiersTable)
    .where(inArray(modifiersTable.loyverseId, modifierIds));

  // Return in same order as item's modifier_ids list
  const ordered = modifierIds
    .map((lid) => mods.find((m) => m.loyverseId === lid))
    .filter(Boolean);

  res.json(ordered);
});

router.patch("/menu/items/:id", async (req, res): Promise<void> => {
  const params = UpdateMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMenuItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.price !== undefined) updates.price = String(parsed.data.price);
  if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
  if (parsed.data.posImageUrl !== undefined) updates.posImageUrl = parsed.data.posImageUrl;
  if (parsed.data.available !== undefined) updates.available = parsed.data.available;
  if (parsed.data.popular !== undefined) updates.popular = parsed.data.popular;
  if (parsed.data.spicy !== undefined) updates.spicy = parsed.data.spicy;
  if (parsed.data.vegetarian !== undefined) updates.vegetarian = parsed.data.vegetarian;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.loyverseModifierIds !== undefined) updates.loyverseModifierIds = parsed.data.loyverseModifierIds ?? null;

  const [item] = await db
    .update(menuItemsTable)
    .set(updates)
    .where(eq(menuItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json({ ...item, price: parseFloat(item.price as unknown as string) });
});

// ---- Category reorder ----
// Accepts { ids: number[] } — the full ordered list of category IDs.
router.post("/menu/categories/reorder", async (req, res): Promise<void> => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.some((v) => typeof v !== "number")) {
    res.status(400).json({ error: "ids must be an array of numbers" });
    return;
  }
  const typedIds = ids as number[];
  await Promise.all(
    typedIds.map((id, idx) =>
      db.update(menuCategoriesTable).set({ sortOrder: idx * 10 }).where(eq(menuCategoriesTable.id, id))
    )
  );
  res.json({ ok: true });
});

// ---- Bulk reorder ----
// Accepts { ids: number[] } — the full ordered list of item IDs.
// Assigns sortOrder = index * 10, persisting the drag-drop sequence.
router.post("/menu/items/reorder", async (req, res): Promise<void> => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.some((v) => typeof v !== "number")) {
    res.status(400).json({ error: "ids must be an array of numbers" });
    return;
  }
  const typedIds = ids as number[];
  await Promise.all(
    typedIds.map((id, idx) =>
      db.update(menuItemsTable).set({ sortOrder: idx * 10 }).where(eq(menuItemsTable.id, id))
    )
  );
  res.json({ ok: true });
});

router.delete("/menu/items/:id", async (req, res): Promise<void> => {
  const params = DeleteMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(menuItemsTable)
    .where(eq(menuItemsTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.sendStatus(204);
});

// ---- Modifiers CRUD ----

router.get("/menu/modifiers", async (_req, res): Promise<void> => {
  const modifiers = await db
    .select()
    .from(modifiersTable)
    .orderBy(modifiersTable.name);
  res.json(modifiers);
});

router.post("/menu/modifiers", async (req, res): Promise<void> => {
  const { name, options, required, minSelections, maxSelections } = req.body as {
    name?: string; options?: unknown[]; required?: boolean; minSelections?: number; maxSelections?: number | null;
  };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const loyverseId = `manual_${crypto.randomUUID()}`;
  const [modifier] = await db
    .insert(modifiersTable)
    .values({
      loyverseId,
      name: name.trim(),
      options: (options ?? []) as import("@workspace/db").ModifierOption[],
      required: required ?? false,
      minSelections: minSelections ?? 0,
      maxSelections: maxSelections ?? null,
    })
    .returning();
  res.status(201).json(modifier);
});

router.patch("/menu/modifiers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, options, required, minSelections, maxSelections } = req.body as {
    name?: string; options?: unknown[]; required?: boolean; minSelections?: number; maxSelections?: number | null;
  };
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (options !== undefined) updates.options = options;
  if (required !== undefined) updates.required = required;
  if (minSelections !== undefined) updates.minSelections = minSelections;
  if (maxSelections !== undefined) updates.maxSelections = maxSelections === null ? null : Number(maxSelections);
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [modifier] = await db
    .update(modifiersTable)
    .set(updates)
    .where(eq(modifiersTable.id, id))
    .returning();
  if (!modifier) { res.status(404).json({ error: "Modifier not found" }); return; }
  res.json(modifier);
});

router.delete("/menu/modifiers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db
    .delete(modifiersTable)
    .where(eq(modifiersTable.id, id))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Modifier not found" }); return; }
  res.sendStatus(204);
});

export default router;
