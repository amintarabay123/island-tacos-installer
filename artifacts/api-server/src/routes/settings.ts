import { Router } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { pushSettingsToCloud } from "../lib/online-orders-sync";

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
  // Comma-separated JS day indices: 0=Sun,1=Mon,...,6=Sat. Default Mon–Sat.
  open_days: "1,2,3,4,5,6",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse open_days setting string into a Set of JS day-of-week numbers (0=Sun). */
export function parseOpenDays(raw: string | undefined): Set<number> {
  const str = raw ?? SETTING_DEFAULTS.open_days;
  const days = str.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n >= 0 && n <= 6);
  return new Set(days.length > 0 ? days : [1, 2, 3, 4, 5, 6]);
}

/** Returns a human-readable days string, e.g. "Mon – Sat" or "Mon, Wed, Fri". */
export function formatOpenDays(raw: string | undefined): string {
  const days = [...parseOpenDays(raw)].sort((a, b) => a - b);
  if (days.length === 7) return "every day";
  if (days.length === 0) return "closed";
  const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  // Check if it's a contiguous range
  const isContiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (isContiguous && days.length > 2) {
    return `${FULL[days[0]]} to ${FULL[days[days.length - 1]]}`;
  }
  return days.map(d => FULL[d]).join(", ");
}

/** Returns whether the store is currently accepting online orders, and the effective cutoff time. */
export function computeStoreStatus(settings: Record<string, string>): {
  is_open: boolean;
  closes_orders_at: string;
  open_today: boolean;
  closed_today_reason?: string;
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
  const todayDow = bviDate.getDay(); // 0=Sun … 6=Sat

  const openDays = parseOpenDays(settings.open_days);
  const open_today = openDays.has(todayDow);

  if (!open_today) {
    return {
      is_open: false,
      closes_orders_at,
      open_today: false,
      closed_today_reason: `Closed on ${DAY_NAMES[todayDow]}s`,
    };
  }

  const is_open = currentMins >= openMins && currentMins < cutoffMins;
  return { is_open, closes_orders_at, open_today: true };
}

// GET /api/settings — public, used by footer and display
router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(storeSettingsTable);
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;

  const { is_open, closes_orders_at, open_today, closed_today_reason } = computeStoreStatus(result);
  result.is_open = is_open ? "true" : "false";
  result.open_today = open_today ? "true" : "false";
  if (closed_today_reason) result.closed_today_reason = closed_today_reason;
  result.closes_orders_at = closes_orders_at;

  res.json(result);
});

// PATCH /api/settings — admin only (enforced in routes/index.ts)
router.patch("/settings", async (req, res): Promise<void> => {
  const updates = req.body as Record<string, string>;
  const saved: Record<string, string> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string") continue;
    await db
      .insert(storeSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: storeSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
    saved[key] = value;
  }
  // Push to cloud so online ordering site reflects the change immediately
  pushSettingsToCloud(saved);
  res.json({ ok: true });
});

export default router;
