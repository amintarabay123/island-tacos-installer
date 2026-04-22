import { Router, type IRouter, type Request, type Response } from "express";
import https from "https";
import http from "http";

const router: IRouter = Router();

const ALLOWED_HOSTS = ["api.loyverse.com", "cdn.loyverse.com"];

// ── Server-side image cache ──────────────────────────────────────────────────
// Images from Loyverse are fetched once, buffered in memory, and served
// instantly on every subsequent request. This eliminates random CDN failures
// and rate-limiting. ~50 menu items × ~200 KB avg = ~10 MB total — no concern.
type CachedImage = { buffer: Buffer; contentType: string };
const imageCache = new Map<string, CachedImage>();

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
        resolve(cached);
      });
      upstream.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// In-flight deduplication: don't fetch the same URL twice concurrently
const inFlight = new Map<string, Promise<CachedImage>>();

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
    // Serve from cache if available
    let cached = imageCache.get(targetUrl);
    if (!cached) {
      // Deduplicate concurrent requests for the same URL
      let pending = inFlight.get(targetUrl);
      if (!pending) {
        pending = fetchAndCache(targetUrl).finally(() => inFlight.delete(targetUrl));
        inFlight.set(targetUrl, pending);
      }
      cached = await pending;
    }

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

/** Pre-warm the cache for a list of Loyverse image URLs (fire-and-forget) */
export function prewarmImageCache(urls: (string | null | undefined)[]) {
  for (const url of urls) {
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (ALLOWED_HOSTS.includes(parsed.hostname) && !imageCache.has(url) && !inFlight.has(url)) {
        const p = fetchAndCache(url).finally(() => inFlight.delete(url));
        inFlight.set(url, p);
        p.catch(() => {}); // suppress unhandled rejection
      }
    } catch {}
  }
}

export default router;
