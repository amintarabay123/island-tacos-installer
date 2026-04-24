import { Router } from "express";
import { db, storeSettingsTable } from "@workspace/db";

const router = Router();

export const SETTING_DEFAULTS: Record<string, string> = {
  hours: "11am – 7pm daily",
  phone: "284-544-8088",
  address: "Wickhams Cay 1, Road Town, BVI",
  payment_methods: "ATH Móvil · Card · Apple Pay",
  online_payment_methods: '["cash"]',
  open_time: "11:00",
  close_time: "19:00",
  cutoff_minutes: "15",
};

/** Returns whether the store is currently accepting online orders, and the effective cutoff time. */
export function computeStoreStatus(settings: Record<string, string>): {
  is_open: boolean;
  closes_orders_at: string;
} {
  const openTime = settings.open_time ?? "11:00";
  const closeTime = settings.close_time ?? "19:00";
  const cutoffMinutes = Math.max(0, parseInt(settings.cutoff_minutes ?? "15") || 0);

  const parseTime = (t: string): number => {
    const parts = t.split(":").map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const openMins = parseTime(openTime);
  const closeMins = parseTime(closeTime);
  const cutoffMins = closeMins - cutoffMinutes;

  const cutoffH = Math.floor(cutoffMins / 60);
  const cutoffM = cutoffMins % 60;
  const closes_orders_at = `${String(cutoffH).padStart(2, "0")}:${String(Math.max(0, cutoffM)).padStart(2, "0")}`;

  // BVI = America/Puerto_Rico (UTC-4, no DST)
  const now = new Date();
  const bviDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
  const currentMins = bviDate.getHours() * 60 + bviDate.getMinutes();

  const is_open = currentMins >= openMins && currentMins < cutoffMins;
  return { is_open, closes_orders_at };
}

// GET /api/settings — public, used by footer and display
router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(storeSettingsTable);
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;

  const { is_open, closes_orders_at } = computeStoreStatus(result);
  result.is_open = is_open ? "true" : "false";
  result.closes_orders_at = closes_orders_at;

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
