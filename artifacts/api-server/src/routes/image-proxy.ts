import { Router, type IRouter, type Request, type Response } from "express";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

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

function urlToKey(targetUrl: string): string {
  return Buffer.from(targetUrl, "utf8").toString("base64url");
}

function diskBinPath(key: string) { return path.join(CACHE_DIR, `${key}.bin`); }
function diskCtPath(key: string)  { return path.join(CACHE_DIR, `${key}.ct`);  }

/** Load an image from disk into the in-memory cache. Returns true if found. */
function loadFromDisk(targetUrl: string): boolean {
  const key = urlToKey(targetUrl);
  const binPath = diskBinPath(key);
  const ctPath  = diskCtPath(key);
  try {
    if (fs.existsSync(binPath) && fs.existsSync(ctPath)) {
      const buffer = fs.readFileSync(binPath);
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

/** Fetch from upstream, write to disk + memory. */
function fetchAndCache(targetUrl: string): Promise<CachedImage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.get(targetUrl, { headers: { "User-Agent": "IslandTacos/1.0" } }, (upstream) => {
      if ((upstream.statusCode ?? 0) !== 200) {
        upstream.resume();
        return reject(new Error(`Upstream ${upstream.statusCode}`));
      }
      const contentType = upstream.headers["content-type"] ?? "image/jpeg";
      const chunks: Buffer[] = [];
      upstream.on("data", (chunk: Buffer) => chunks.push(chunk));
      upstream.on("end", () => {
        const cached: CachedImage = { buffer: Buffer.concat(chunks), contentType };
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
  } catch {
    res.status(502).end();
  }
});

/** Convert a Loyverse image URL to our proxied URL */
export function proxyImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (ALLOWED_HOSTS.includes(parsed.hostname)) {
      const encoded = Buffer.from(raw, "utf8").toString("base64url");
      return `/api/image-proxy?url=${encoded}`;
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
 * Called once after the server starts listening.
 */
export async function warmAllMenuImages() {
  try {
    const { db, menuItemsTable } = await import("@workspace/db");
    const items = await db.select({
      imageUrl: menuItemsTable.imageUrl,
      posImageUrl: menuItemsTable.posImageUrl,
    }).from(menuItemsTable);

    const urls = items.flatMap(i => [i.imageUrl, i.posImageUrl]).filter(Boolean) as string[];
    let fetched = 0;
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        if (!ALLOWED_HOSTS.includes(parsed.hostname)) continue;
        if (imageCache.has(url)) continue;
        // Check disk first (fast, no network)
        if (loadFromDisk(url)) { fetched++; continue; }
        // Fetch from Loyverse (rate-limit: max 3 concurrent)
        ensureCached(url).catch(() => {});
        fetched++;
        // Small stagger to avoid hammering CDN
        if (fetched % 5 === 0) await new Promise(r => setTimeout(r, 200));
      } catch {}
    }
  } catch (e) {
    console.error("[image-warm] failed:", e);
  }
}

export default router;
