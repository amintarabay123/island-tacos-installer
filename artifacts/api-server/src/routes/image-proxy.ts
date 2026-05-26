import { Router, type IRouter, type Request, type Response } from "express";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_HOSTS = ["api.loyverse.com", "cdn.loyverse.com"];

// ── Disk-persisted image cache ───────────────────────────────────────────────
// Images are saved to disk so they survive server restarts. The in-memory map
// is a fast lookup layer on top; the disk is the source of truth.
//
// Directory: .image-cache/ inside the api-server artifact.
// Each file: <base64url(url)>.bin  +  <base64url(url)>.ct (content-type)
const CACHE_DIR = path.join(process.cwd(), ".image-cache");

try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}

type CachedImage = { buffer: Buffer; contentType: string };
const imageCache = new Map<string, CachedImage>();

// ── Loyverse placeholder detection ───────────────────────────────────────────
// Loyverse returns a generic placeholder JPEG when an item has no real photo.
// These appear as dark/black boxes in the POS. We detect them by SHA-256 and
// treat them as "no image" so the POS shows the styled emoji fallback instead.
const LOYVERSE_PLACEHOLDER_HASHES = new Set([
  "fe6dced500e2b6fe573222e65ad8bc72a37f4a3978128c5a37d2cb47717b5758", // Salad items (5 variants share this)
  "cfaeb574054b2949ed8e17bea7b80804d6ad15347654148008e21439b412159a", // xSoda/Juice placeholder
  "5e7e51d35b3266088c4ec3252ca372637ef06ab9430a11d64b022f403376e3b0", // xJarritos placeholder
  "5160902186c2fc08963ecedc27a6a0cdda7a99fef30535157e8df844bb9eb6db", // wMisc placeholder
]);

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function isLoyversePlaceholder(buf: Buffer): boolean {
  return LOYVERSE_PLACEHOLDER_HASHES.has(sha256(buf));
}

function urlToKey(targetUrl: string): string {
  return Buffer.from(targetUrl, "utf8").toString("base64url");
}

function diskBinPath(key: string) { return path.join(CACHE_DIR, `${key}.bin`); }
function diskCtPath(key: string)  { return path.join(CACHE_DIR, `${key}.ct`);  }

function deleteDiskFiles(targetUrl: string) {
  const key = urlToKey(targetUrl);
  try { fs.unlinkSync(diskBinPath(key)); } catch {}
  try { fs.unlinkSync(diskCtPath(key)); } catch {}
}

/** Load an image from disk into the in-memory cache. Returns true if found. */
function loadFromDisk(targetUrl: string): boolean {
  const key = urlToKey(targetUrl);
  const binPath = diskBinPath(key);
  const ctPath  = diskCtPath(key);
  try {
    if (fs.existsSync(binPath) && fs.existsSync(ctPath)) {
      const buffer = fs.readFileSync(binPath);
      // Reject cached Loyverse placeholder images
      if (isLoyversePlaceholder(buffer)) {
        fs.unlinkSync(binPath);
        try { fs.unlinkSync(ctPath); } catch {}
        return false;
      }
      const contentType = fs.readFileSync(ctPath, "utf8");
      imageCache.set(targetUrl, { buffer, contentType });
      return true;
    }
  } catch {}
  return false;
}

/** Write a fetched image to disk for persistence across restarts. */
function saveToDisk(targetUrl: string, cached: CachedImage) {
  const key = urlToKey(targetUrl);
  try {
    fs.writeFileSync(diskBinPath(key), cached.buffer);
    fs.writeFileSync(diskCtPath(key), cached.contentType, "utf8");
  } catch {}
}

class PlaceholderImageError extends Error {
  constructor() { super("LOYVERSE_PLACEHOLDER"); this.name = "PlaceholderImageError"; }
}

const LOYVERSE_TOKEN = process.env.LOYVERSE_API_TOKEN ?? "";

/** Fetch from upstream, write to disk + memory. */
function fetchAndCache(targetUrl: string): Promise<CachedImage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const isLoyverse = ALLOWED_HOSTS.includes(parsed.hostname);
    const fetchHeaders: Record<string, string> = { "User-Agent": "IslandTacos/1.0" };
    if (isLoyverse && LOYVERSE_TOKEN) fetchHeaders["Authorization"] = `Bearer ${LOYVERSE_TOKEN}`;
    const req = lib.get(targetUrl, { headers: fetchHeaders }, (upstream) => {
      if ((upstream.statusCode ?? 0) !== 200) {
        upstream.resume();
        return reject(new Error(`Upstream ${upstream.statusCode}`));
      }
      const contentType = upstream.headers["content-type"] ?? "image/jpeg";
      const chunks: Buffer[] = [];
      upstream.on("data", (chunk: Buffer) => chunks.push(chunk));
      upstream.on("end", () => {
        const buffer = Buffer.concat(chunks);
        // Reject Loyverse placeholder images — don't cache, signal 404
        if (isLoyversePlaceholder(buffer)) {
          return reject(new PlaceholderImageError());
        }
        const cached: CachedImage = { buffer, contentType };
        imageCache.set(targetUrl, cached);
        saveToDisk(targetUrl, cached);
        resolve(cached);
      });
      upstream.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20_000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// In-flight deduplication: don't fetch the same URL twice concurrently
const inFlight = new Map<string, Promise<CachedImage>>();

/** Ensure an image is in cache (memory → disk → upstream). */
async function ensureCached(targetUrl: string): Promise<CachedImage> {
  // 1. Memory cache
  const mem = imageCache.get(targetUrl);
  if (mem) return mem;

  // 2. Disk cache (avoids re-download after restart)
  if (loadFromDisk(targetUrl)) return imageCache.get(targetUrl)!;

  // 3. Fetch from upstream, deduplicating concurrent requests
  let pending = inFlight.get(targetUrl);
  if (!pending) {
    pending = fetchAndCache(targetUrl).finally(() => inFlight.delete(targetUrl));
    inFlight.set(targetUrl, pending);
  }
  return pending;
}

// GET /image-proxy?url=<base64url-encoded-url>
router.get("/image-proxy", async (req: Request, res: Response): Promise<void> => {
  const raw = req.query.url as string | undefined;
  if (!raw) { res.status(400).json({ error: "Missing url" }); return; }

  let targetUrl: string;
  try {
    targetUrl = Buffer.from(raw, "base64url").toString("utf8");
    new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid url" }); return;
  }

  const parsed = new URL(targetUrl);
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" }); return;
  }

  try {
    const cached = await ensureCached(targetUrl);
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Content-Length", cached.buffer.length);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(cached.buffer);
  } catch (err) {
    if (err instanceof PlaceholderImageError) {
      res.status(404).setHeader("Cache-Control", "no-store").json({ error: "No image" });
    } else {
      res.status(502).end();
    }
  }
});

const OWN_STORAGE_HOST = "orders.islandtacosbvi.com";

/** Convert an image URL to a server-routed URL.
 *  - Loyverse CDN → /api/image-proxy?url=… (cached proxy)
 *  - Our own production storage (absolute) → relative /api/storage/… path
 *    so it goes through the local server's redirect-to-production fallback
 *  - Everything else → returned as-is
 */
export function proxyImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (ALLOWED_HOSTS.includes(parsed.hostname)) {
      const encoded = Buffer.from(raw, "utf8").toString("base64url");
      return `/api/image-proxy?url=${encoded}`;
    }
    if (parsed.hostname === OWN_STORAGE_HOST && parsed.pathname.startsWith("/api/storage/")) {
      return parsed.pathname;
    }
  } catch {}
  return raw;
}

/** Pre-warm: ensure every URL is cached (memory → disk → fetch). Fire-and-forget. */
export function prewarmImageCache(urls: (string | null | undefined)[]) {
  for (const url of urls) {
    if (!url) continue;
    try {
      new URL(url);
      const parsed = new URL(url);
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) continue;
      // Skip if already in memory
      if (imageCache.has(url)) continue;
      ensureCached(url).catch(() => {});
    } catch {}
  }
}

/**
 * Eagerly warm all menu images from DB on server startup.
 * Also detects and removes Loyverse placeholder images from cache + DB,
 * so the frontend shows the emoji fallback instead of a dark box.
 */
export async function warmAllMenuImages() {
  try {
    const { db, menuItemsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");

    const items = await db.select({
      imageUrl: menuItemsTable.imageUrl,
      posImageUrl: menuItemsTable.posImageUrl,
    }).from(menuItemsTable);

    const allUrls = items.flatMap(i => [i.imageUrl, i.posImageUrl]).filter(Boolean) as string[];
    const placeholderUrls: string[] = [];

    let fetched = 0;
    for (const url of allUrls) {
      try {
        const parsed = new URL(url);
        if (!ALLOWED_HOSTS.includes(parsed.hostname)) continue;

        // Check disk first
        const key = urlToKey(url);
        const binPath = diskBinPath(key);
        if (fs.existsSync(binPath)) {
          const buf = fs.readFileSync(binPath);
          if (isLoyversePlaceholder(buf)) {
            // Delete bad cache files and mark URL for DB clearing
            deleteDiskFiles(url);
            imageCache.delete(url);
            placeholderUrls.push(url);
            logger.info(`[image-warm] placeholder detected, clearing: ${url}`);
            continue;
          }
        }

        if (imageCache.has(url)) continue;
        if (loadFromDisk(url)) { fetched++; continue; }

        // Fetch from Loyverse (placeholder detection happens inside fetchAndCache)
        ensureCached(url).catch((err) => {
          if (err instanceof PlaceholderImageError) {
            placeholderUrls.push(url);
          }
        });
        fetched++;
        if (fetched % 5 === 0) await new Promise(r => setTimeout(r, 200));
      } catch {}
    }

    // Clear placeholder image URLs from the DB so the menu API returns null for them
    if (placeholderUrls.length > 0) {
      logger.info(`[image-warm] Nulling ${placeholderUrls.length} placeholder image_url(s) in DB`);
      // Clear imageUrl where it's a placeholder
      const placeholderImageUrls = placeholderUrls.filter(u =>
        items.some(i => i.imageUrl === u)
      );
      const placeholderPosImageUrls = placeholderUrls.filter(u =>
        items.some(i => i.posImageUrl === u)
      );
      if (placeholderImageUrls.length > 0) {
        await db.update(menuItemsTable)
          .set({ imageUrl: null })
          .where(inArray(menuItemsTable.imageUrl, placeholderImageUrls));
      }
      if (placeholderPosImageUrls.length > 0) {
        await db.update(menuItemsTable)
          .set({ posImageUrl: null })
          .where(inArray(menuItemsTable.posImageUrl, placeholderPosImageUrls));
      }
    }
  } catch (e) {
    logger.error({ err: e }, "[image-warm] failed");
  }
}

export default router;
