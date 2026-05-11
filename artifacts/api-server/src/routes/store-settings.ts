import { Router, type IRouter, type Request, type Response } from "express";
import { db, storeProfileTable, updateStoreProfileSchema } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import {
  getStoreSettings,
  refreshStoreSettings,
} from "../lib/store-settings";

const router: IRouter = Router();

// GET /api/store-settings — PUBLIC. Used by frontend header/footer/emails.
// 60 s cache lives in store-settings.ts (single in-flight DB query under load).
router.get("/store-settings", async (_req: Request, res: Response): Promise<void> => {
  try {
    const profile = await getStoreSettings();
    res.json(profile);
  } catch (err) {
    _req.log.error({ err }, "store-settings GET failed");
    res.status(500).json({ error: "Store profile is missing or unreadable" });
  }
});

// PATCH /api/store-settings — admin only (auth enforced in routes/index.ts).
// Partial update. Always re-reads the row after writing so the response is
// authoritative, and invalidates the in-memory cache so the next GET reflects
// the change within the current request.
router.patch("/store-settings", async (req: Request, res: Response): Promise<void> => {
  const parsed = updateStoreProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  // Single-row model — pick the lowest id (matches getStoreSettings()).
  const existing = await db
    .select({ id: storeProfileTable.id })
    .from(storeProfileTable)
    .orderBy(asc(storeProfileTable.id))
    .limit(1);

  const row = existing[0];
  if (!row) {
    res.status(500).json({
      error: "Store profile not seeded — run local-install/schema.sql",
    });
    return;
  }

  const [updated] = await db
    .update(storeProfileTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(storeProfileTable.id, row.id))
    .returning();

  refreshStoreSettings();
  req.log.info({ id: row.id, keys: Object.keys(updates) }, "store profile updated");
  res.json(updated);
});

export default router;
