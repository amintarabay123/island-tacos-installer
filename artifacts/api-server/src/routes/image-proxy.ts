import { Router, type IRouter, type Request, type Response } from "express";
import https from "https";
import http from "http";

const router: IRouter = Router();

const ALLOWED_HOSTS = ["api.loyverse.com", "cdn.loyverse.com"];

// GET /image-proxy?url=<base64-encoded-url>
router.get("/image-proxy", (req: Request, res: Response): void => {
  const raw = req.query.url as string | undefined;
  if (!raw) { res.status(400).json({ error: "Missing url" }); return; }

  let targetUrl: string;
  try {
    targetUrl = Buffer.from(raw, "base64url").toString("utf8");
    new URL(targetUrl); // validate
  } catch {
    res.status(400).json({ error: "Invalid url" }); return;
  }

  const parsed = new URL(targetUrl);
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" }); return;
  }

  const lib = parsed.protocol === "https:" ? https : http;
  const proxyReq = lib.get(targetUrl, { headers: { "User-Agent": "IslandTacos/1.0" } }, (upstream) => {
    const status = upstream.statusCode ?? 502;
    if (status !== 200) {
      res.status(status).end();
      upstream.resume();
      return;
    }
    res.setHeader("Content-Type", upstream.headers["content-type"] ?? "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");
    upstream.pipe(res);
  });

  proxyReq.on("error", () => { res.status(502).end(); });
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

export default router;
