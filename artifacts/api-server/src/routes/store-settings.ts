import { Router, type IRouter, type Request, type Response } from "express";
import { db, storeProfileTable, updateStoreProfileSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  // Route through getStoreSettings() so the self-heal seed runs if the table
  // is empty — otherwise PATCH would 500 on a fresh DB even though GET would
  // have transparently seeded. Same accessor, same singleton invariant.
  const existing = await getStoreSettings();

  const [updated] = await db
    .update(storeProfileTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(storeProfileTable.id, existing.id))
    .returning();

  refreshStoreSettings();
  req.log.info({ id: existing.id, keys: Object.keys(updates) }, "store profile updated");
  res.json(updated);
});

export default router;
