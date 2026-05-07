import { Router, type IRouter } from "express";
import { db, menuCategoriesTable, menuItemsTable, modifiersTable, storeSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function checkSyncSecret(req: import("express").Request, res: import("express").Response): boolean {
  const secret = process.env["SYNC_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Sync not configured on this server (SYNC_SECRET not set)" });
    return false;
  }
  if (req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "Invalid sync secret" });
    return false;
  }
  return true;
}

// ── PATCH /sync/settings ─────────────────────────────────────────────────────
// Called by the local server when admin saves settings, so the cloud stays in sync.
// Protected by X-Sync-Secret header.
router.patch("/sync/settings", async (req, res): Promise<void> => {
  if (!checkSyncSecret(req, res)) return;
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Body must be a key-value object" });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string") continue;
    await db
      .insert(storeSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: storeSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  res.json({ ok: true });
});

// ── GET /sync/export ──────────────────────────────────────────────────────────
// Returns a full snapshot of the menu for pushing to the cloud.
// Protected by X-Sync-Secret header.
router.get("/sync/export", async (req, res): Promise<void> => {
  if (!checkSyncSecret(req, res)) return;

  const [categories, items, modifiers, settings] = await Promise.all([
    db.select().from(menuCategoriesTable).orderBy(menuCategoriesTable.sortOrder),
    db.select().from(menuItemsTable).orderBy(menuItemsTable.sortOrder),
    db.select().from(modifiersTable).orderBy(modifiersTable.sortOrder),
    db.select().from(storeSettingsTable),
  ]);

  res.json({ categories, items, modifiers, settings, exportedAt: new Date().toISOString() });
});

// ── POST /sync/receive ────────────────────────────────────────────────────────
// Receives a full menu snapshot and replaces the local menu data.
// Protected by X-Sync-Secret header.
// Only menu tables are touched — orders, shifts, customers etc. are untouched.
router.post("/sync/receive", async (req, res): Promise<void> => {
  if (!checkSyncSecret(req, res)) return;

  const { categories, items, modifiers, settings } = req.body as {
    categories: (typeof menuCategoriesTable.$inferSelect)[];
    items:      (typeof menuItemsTable.$inferSelect)[];
    modifiers:  (typeof modifiersTable.$inferSelect)[];
    settings:   (typeof storeSettingsTable.$inferSelect)[];
  };

  if (!Array.isArray(categories) || !Array.isArray(items)) {
    res.status(400).json({ error: "Invalid payload — categories and items required" });
    return;
  }

  await db.transaction(async (tx) => {
    // Clear existing menu (items cascade-delete from categories)
    await tx.delete(modifiersTable);
    await tx.delete(menuItemsTable);
    await tx.delete(menuCategoriesTable);

    // Re-insert categories (preserve original IDs so item categoryId refs work)
    if (categories.length > 0) {
      await tx.insert(menuCategoriesTable).values(
        categories.map(({ id, name, description, icon, sortOrder, sendToKds, loyverseId }) => ({
          id, name, description, icon, sortOrder, sendToKds,
          loyverseId: loyverseId ?? null,
        }))
      );
    }

    // Re-insert items
    if (items.length > 0) {
      await tx.insert(menuItemsTable).values(
        items.map(({ id, categoryId, name, description, price, imageUrl, posImageUrl,
                      available, popular, spicy, vegetarian, sortOrder,
                      loyverseItemId, loyverseVariantId, loyverseModifierIds }) => ({
          id, categoryId, name, description, price, imageUrl, posImageUrl,
          available, popular, spicy, vegetarian, sortOrder,
          loyverseItemId: loyverseItemId ?? null,
          loyverseVariantId: loyverseVariantId ?? null,
          loyverseModifierIds: loyverseModifierIds ?? null,
        }))
      );
    }

    // Re-insert modifiers
    if (modifiers.length > 0) {
      await tx.insert(modifiersTable).values(
        modifiers.map(({ id, loyverseId, name, options, required,
                         minSelections, maxSelections, sortOrder }) => ({
          id, loyverseId, name, options, required,
          minSelections, maxSelections: maxSelections ?? null, sortOrder,
        }))
      );
    }

    // Upsert settings (key-value, just update what came in — don't delete local-only settings)
    for (const setting of settings ?? []) {
      await tx.insert(storeSettingsTable)
        .values({ key: setting.key, value: setting.value })
        .onConflictDoUpdate({ target: storeSettingsTable.key, set: { value: setting.value } });
    }

    // Reset sequences so new inserts don't conflict with the restored IDs
    if (categories.length > 0) {
      const maxCatId = Math.max(...categories.map(c => c.id));
      await tx.execute(sql`SELECT setval('menu_categories_id_seq', ${maxCatId}, true)`);
    }
    if (items.length > 0) {
      const maxItemId = Math.max(...items.map(i => i.id));
      await tx.execute(sql`SELECT setval('menu_items_id_seq', ${maxItemId}, true)`);
    }
    if (modifiers.length > 0) {
      const maxModId = Math.max(...modifiers.map(m => m.id));
      await tx.execute(sql`SELECT setval('modifiers_id_seq', ${maxModId}, true)`);
    }
  });

  logger.info({ categories: categories.length, items: items.length, modifiers: modifiers.length }, "Menu sync received");
  res.json({ ok: true, categories: categories.length, items: items.length, modifiers: modifiers.length });
});

// ── POST /sync/pull ───────────────────────────────────────────────────────────
// Pulls the full menu snapshot from the cloud and imports it locally.
// Called from the local admin UI or on startup when menu is empty.
// Protected by admin session auth in routes/index.ts.
router.post("/sync/pull", async (req, res): Promise<void> => {
  try {
    const result = await pullMenuFromCloud();
    if ("error" in result) {
      res.status(502).json(result);
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: `Pull failed: ${String(err)}` });
  }
});

/**
 * Pull menu + settings from the cloud into this local database.
 * Returns an error object on failure or counts on success.
 * Safe to call on startup — only runs when SYNC_TARGET_URL is configured.
 */
export async function pullMenuFromCloud(): Promise<
  { error: string } | { categories: number; items: number; modifiers: number }
> {
  const cloudUrl = process.env["SYNC_TARGET_URL"]?.replace(/\/$/, "");
  const secret   = process.env["SYNC_SECRET"];

  if (!cloudUrl || !secret) {
    return { error: "SYNC_TARGET_URL or SYNC_SECRET not set — cannot pull from cloud" };
  }

  let exportRes: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    exportRes = await fetch(`${cloudUrl}/api/sync/export`, {
      headers: { "x-sync-secret": secret },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    return { error: `Network error reaching cloud: ${String(err)}` };
  }

  if (!exportRes.ok) {
    const body = await exportRes.text().catch(() => "");
    return { error: `Cloud export returned ${exportRes.status}: ${body}` };
  }

  const payload = await exportRes.json() as {
    categories: (typeof menuCategoriesTable.$inferSelect)[];
    items:      (typeof menuItemsTable.$inferSelect)[];
    modifiers:  (typeof modifiersTable.$inferSelect)[];
    settings:   (typeof storeSettingsTable.$inferSelect)[];
  };

  const { categories = [], items = [], modifiers = [], settings = [] } = payload;

  await db.transaction(async (tx) => {
    await tx.delete(modifiersTable);
    await tx.delete(menuItemsTable);
    await tx.delete(menuCategoriesTable);

    if (categories.length > 0) {
      await tx.insert(menuCategoriesTable).values(
        categories.map(({ id, name, description, icon, sortOrder, sendToKds, loyverseId }) => ({
          id, name, description, icon, sortOrder, sendToKds, loyverseId: loyverseId ?? null,
        }))
      );
    }
    if (items.length > 0) {
      await tx.insert(menuItemsTable).values(
        items.map(({ id, categoryId, name, description, price, imageUrl, posImageUrl,
                      available, popular, spicy, vegetarian, sortOrder,
                      loyverseItemId, loyverseVariantId, loyverseModifierIds }) => ({
          id, categoryId, name, description, price, imageUrl, posImageUrl,
          available, popular, spicy, vegetarian, sortOrder,
          loyverseItemId: loyverseItemId ?? null,
          loyverseVariantId: loyverseVariantId ?? null,
          loyverseModifierIds: loyverseModifierIds ?? null,
        }))
      );
    }
    if (modifiers.length > 0) {
      await tx.insert(modifiersTable).values(
        modifiers.map(({ id, loyverseId, name, options, required,
                         minSelections, maxSelections, sortOrder }) => ({
          id, loyverseId, name, options, required,
          minSelections, maxSelections: maxSelections ?? null, sortOrder,
        }))
      );
    }
    for (const s of settings) {
      await tx.insert(storeSettingsTable)
        .values({ key: s.key, value: s.value })
        .onConflictDoUpdate({ target: storeSettingsTable.key, set: { value: s.value } });
    }
    if (categories.length > 0) {
      const maxCatId = Math.max(...categories.map(c => c.id));
      await tx.execute(sql`SELECT setval('menu_categories_id_seq', ${maxCatId}, true)`);
    }
    if (items.length > 0) {
      const maxItemId = Math.max(...items.map(i => i.id));
      await tx.execute(sql`SELECT setval('menu_items_id_seq', ${maxItemId}, true)`);
    }
    if (modifiers.length > 0) {
      const maxModId = Math.max(...modifiers.map(m => m.id));
      await tx.execute(sql`SELECT setval('modifiers_id_seq', ${maxModId}, true)`);
    }
  });

  logger.info({ categories: categories.length, items: items.length, modifiers: modifiers.length }, "Menu pulled from cloud");
  return { categories: categories.length, items: items.length, modifiers: modifiers.length };
}

// ── POST /sync/push ───────────────────────────────────────────────────────────
// Convenience: export local menu and push it to SYNC_TARGET_URL in one call.
// Called from the admin UI — protected by admin session auth in routes/index.ts.
router.post("/sync/push", async (req, res): Promise<void> => {

  const targetUrl = process.env["SYNC_TARGET_URL"];
  if (!targetUrl) {
    res.status(503).json({ error: "SYNC_TARGET_URL not set — this server is not configured to push to a cloud server" });
    return;
  }
  const secret = process.env["SYNC_SECRET"]!;

  // Export local menu
  const [categories, items, modifiers, settings] = await Promise.all([
    db.select().from(menuCategoriesTable).orderBy(menuCategoriesTable.sortOrder),
    db.select().from(menuItemsTable).orderBy(menuItemsTable.sortOrder),
    db.select().from(modifiersTable).orderBy(modifiersTable.sortOrder),
    db.select().from(storeSettingsTable),
  ]);

  const payload = { categories, items, modifiers, settings };

  // Push to cloud
  const cloudRes = await fetch(`${targetUrl}/api/sync/receive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": secret },
    body: JSON.stringify(payload),
  });

  if (!cloudRes.ok) {
    const err = await cloudRes.text();
    logger.error({ status: cloudRes.status, err }, "Sync push failed");
    res.status(502).json({ error: `Cloud server returned ${cloudRes.status}: ${err}` });
    return;
  }

  const result = await cloudRes.json();
  logger.info(result, "Menu pushed to cloud");
  res.json({ ok: true, pushed: result });
});

export default router;
