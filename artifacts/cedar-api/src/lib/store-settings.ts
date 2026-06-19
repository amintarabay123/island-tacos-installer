import { db, storeProfileTable, type StoreProfile } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { logger } from "./logger";

// Public-facing type the rest of the codebase consumes. We export both the
// raw DB row (`StoreProfile`) and this alias so call sites can write
// `StoreSettings` without having to know about the underlying table.
export type StoreSettings = StoreProfile;

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: StoreSettings;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<StoreSettings> | null = null;

async function loadFromDb(): Promise<StoreSettings> {
  // STORE_PROFILE_ID lets a single Postgres cluster host multiple tenants.
  // cedar-api sets this to 2 (Cedar Cafe row); api-server leaves it unset
  // and falls back to the lowest-id row (Island Tacos, id=1).
  const profileId = process.env.STORE_PROFILE_ID ? parseInt(process.env.STORE_PROFILE_ID, 10) : null;

  const rows = profileId
    ? await db.select().from(storeProfileTable).where(eq(storeProfileTable.id, profileId)).limit(1)
    : await db.select().from(storeProfileTable).orderBy(asc(storeProfileTable.id)).limit(1);

  if (rows[0]) return rows[0];

  // Self-heal: the table exists (Publish ran the schema diff) but the seed
  // row is missing. This happens on:
  //   1. The cloud production DB after the first Publish — Publish migrates
  //      schema only, never inserts seed data.
  //   2. A fresh mini-PC install that booted the API before
  //      `local-install/schema.sql` ran its INSERT.
  //
  // Values come from env vars so we don't bake brand strings into the codebase
  // (see replit.md → SaaS vision: every tenant gets its own profile).
  // Operator can override any field later via PATCH /api/store-settings.
  logger.warn(
    "store_profile empty — seeding default row from env vars (set STORE_NAME, STORE_PHONE, etc. to customise)",
  );
  const seed = {
    // Pin id=1 deliberately. `store_profile` has no application-level singleton
    // constraint (just a serial PK), so a plain INSERT on cold start could let
    // two concurrent boots both succeed and create two rows — after which the
    // ORDER BY id LIMIT 1 reader silently picks one and ignores the other.
    // Pinning id=1 turns concurrent inserts into a primary-key conflict, and
    // `.onConflictDoNothing()` on that PK makes the seed atomic & idempotent.
    id: profileId ?? 1,
    storeName: process.env.STORE_NAME ?? "My Restaurant",
    phone: process.env.STORE_PHONE ?? "",
    email: process.env.STORE_EMAIL ?? "",
    address: process.env.STORE_ADDRESS ?? "",
    taxRate: process.env.STORE_TAX_RATE ?? "0",
    timezone: process.env.STORE_TIMEZONE ?? "UTC",
    currency: process.env.STORE_CURRENCY ?? "USD",
  };
  const inserted = await db
    .insert(storeProfileTable)
    .values(seed)
    .onConflictDoNothing({ target: storeProfileTable.id })
    .returning();
  if (inserted[0]) return inserted[0];

  // Race: another concurrent boot inserted first. Re-read and use that row.
  const reread = profileId
    ? await db.select().from(storeProfileTable).where(eq(storeProfileTable.id, profileId)).limit(1)
    : await db.select().from(storeProfileTable).orderBy(asc(storeProfileTable.id)).limit(1);
  if (reread[0]) return reread[0];

  throw new Error("store_profile self-seed failed — DB write returned no row");
}

/**
 * Returns the single tenant profile row. Cached in-memory for 60 s — call
 * `refreshStoreSettings()` after any update to invalidate immediately.
 *
 * Concurrent callers during a cache miss share a single in-flight DB query
 * (no thundering herd on cold cache / boot).
 *
 * Throws if the table is empty — never returns silent defaults in
 * production. See replit.md → SaaS vision.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  if (inflight) return inflight;

  inflight = loadFromDb()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * Invalidate the cache. Call from any code path that mutates
 * `store_profile` so subsequent reads see the new value within the
 * current request, not after the 60 s TTL.
 */
export function refreshStoreSettings(): void {
  cache = null;
  logger.debug("store_profile cache invalidated");
}
