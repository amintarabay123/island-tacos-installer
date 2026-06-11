import { Router } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { pushSettingsToCloud } from "../lib/online-orders-sync";
import { getStoreSettings } from "../lib/store-settings";

const router = Router();

export const SETTING_DEFAULTS: Record<string, string> = {
  hours: "11am – 7pm daily",
  // TODO(store-settings): the K/V `phone` / `address` defaults are now shadowed by the
  // store_profile overlay in GET /api/settings. Once all readers migrate to
  // getStoreSettings() / useStoreSettings(), drop these two keys from SETTING_DEFAULTS
  // and stop accepting them in PATCH /api/settings.
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

  // When close_time is on the next calendar day (e.g. open 11:00, close 02:00)
  // closeMins will be < openMins. We handle this as a midnight-crossing window.
  const crossesMidnight = closeMins <= openMins;

  // Effective last-order cutoff in minutes-of-day.
  // May go negative if close is very early after midnight — wrap with mod 1440.
  let cutoffMins = closeMins - cutoffMinutes;
  if (cutoffMins < 0) cutoffMins += 1440;

  const cutoffH = Math.floor(cutoffMins / 60);
  const cutoffM = cutoffMins % 60;
  const closes_orders_at = `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`;

  // BVI = America/Puerto_Rico (UTC-4, no DST)
  const now = new Date();
  const bviDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
  const currentMins = bviDate.getHours() * 60 + bviDate.getMinutes();
  const todayDow = bviDate.getDay(); // 0=Sun … 6=Sat

  const openDays = parseOpenDays(settings.open_days);

  // For midnight-crossing windows: if we are currently in the early-morning
  // portion (after midnight but before cutoff), we are still inside yesterday's
  // service window, so the relevant open_days entry is yesterday's.
  const inEarlyMorning = crossesMidnight && currentMins < cutoffMins;
  const relevantDow = inEarlyMorning ? (todayDow + 6) % 7 : todayDow;
  const open_today = openDays.has(relevantDow);

  if (!open_today) {
    return {
      is_open: false,
      closes_orders_at,
      open_today: false,
      closed_today_reason: `Closed on ${DAY_NAMES[relevantDow]}s`,
    };
  }

  // Same-day window: open if openMins ≤ current < cutoffMins
  // Midnight-crossing window: open if current ≥ openMins OR current < cutoffMins
  const is_open = crossesMidnight
    ? currentMins >= openMins || currentMins < cutoffMins
    : currentMins >= openMins && currentMins < cutoffMins;

  return { is_open, closes_orders_at, open_today: true };
}

// GET /api/settings — public, used by footer and display.
// Returns the K/V operational config merged with computed open-status.
// Identity fields (store_name, phone, address, email) are overlaid from
// the typed `store_profile` table — that table is authoritative. The K/V
// `phone` / `address` keys remain readable for back-compat but are
// effectively shadowed; new code should consume `/api/store-settings`
// directly via getStoreSettings() (server) or useGetStoreSettings() (client).
router.get("/settings", async (req, res): Promise<void> => {
  const rows = await db.select().from(storeSettingsTable);
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) result[row.key] = row.value;

  // Overlay store_profile fields. If the table is empty we fall back to the
  // K/V defaults rather than 500-ing here, because this endpoint also drives
  // the live online-ordering site and we don't want to take down the menu
  // page just because the profile row hasn't been seeded yet.
  try {
    const profile = await getStoreSettings();
    result.store_name = profile.storeName;
    result.phone      = profile.phone;
    result.email      = profile.email;
    result.address    = profile.address;
    result.timezone   = profile.timezone;
    result.currency   = profile.currency;
    result.tax_rate   = profile.taxRate;
  } catch (err) {
    req.log.warn({ err }, "store_profile not available — serving K/V defaults for /api/settings");
  }

  const { is_open, closes_orders_at, open_today, closed_today_reason } = computeStoreStatus(result);
  // In dev mode (Replit preview) bypass store hours so testing isn't gated by real open/close times.
  const devOverride = process.env.NODE_ENV === "development";
  result.is_open = (devOverride || is_open) ? "true" : "false";
  result.open_today = (devOverride || open_today) ? "true" : "false";
  if (!devOverride && closed_today_reason) result.closed_today_reason = closed_today_reason;
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
