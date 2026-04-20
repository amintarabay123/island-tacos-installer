import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, menuCategoriesTable, menuItemsTable, modifiersTable } from "@workspace/db";
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
  // Convert price from string to number
  const result = items.map((item) => ({
    ...item,
    price: parseFloat(item.price as unknown as string),
  }));
  res.json(result);
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
  res.json({ ...item, price: parseFloat(item.price as unknown as string) });
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
