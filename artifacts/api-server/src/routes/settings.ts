import { Router } from "express";
import { db, storeSettingsTable } from "@workspace/db";

const router = Router();

export const SETTING_DEFAULTS: Record<string, string> = {
  hours: "11am – 10pm daily",
  phone: "284-544-8088",
  address: "Wickhams Cay 1, Road Town, BVI",
  payment_methods: "ATH Móvil · Card · Apple Pay",
  online_payment_methods: '["cash"]',
};

// GET /api/settings — public, used by footer and display
router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(storeSettingsTable);
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
});

// PATCH /api/settings — admin only (enforced in routes/index.ts)
router.patch("/settings", async (req, res): Promise<void> => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string") continue;
    await db
      .insert(storeSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: storeSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }
  res.json({ ok: true });
});

export default router;
