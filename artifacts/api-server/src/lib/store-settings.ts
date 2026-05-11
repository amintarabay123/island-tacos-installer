import { db, storeProfileTable, type StoreProfile } from "@workspace/db";
import { asc } from "drizzle-orm";
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
  const rows = await db
    .select()
    .from(storeProfileTable)
    .orderBy(asc(storeProfileTable.id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Fail loud. Defaults at this layer would silently mask a real broken
    // install (missing migration / wiped DB) and could end up sending the
    // wrong store name on SMS/receipts. Better to 500 than to lie.
    throw new Error(
      "store_profile is empty — run local-install/schema.sql to seed the row",
    );
  }
  return row;
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
