import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist", "public");
const PORT = Number(process.env.PORT ?? 3001);

const API_URL = process.env.API_SERVER_URL ?? "https://orders.islandtacosbvi.com";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".txt":  "text/plain",
  ".webmanifest": "application/manifest+json",
};

function rewriteSetCookie(cookieHeader) {
  // Strip Domain and Secure so cookies work on localhost
  return cookieHeader
    .replace(/;\s*Domain=[^;]*/gi, "")
    .replace(/;\s*Secure/gi, "")
    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
}

async function proxyApi(req, res) {
  const url = `${API_URL}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const headers = { ...req.headers };
  delete headers["host"];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body.length > 0 ? body : undefined,
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Headers to drop: Node's fetch() auto-decompresses the body, so we must
    // NOT forward content-encoding or content-length — the browser would try
    // to decompress already-decompressed data and get garbage (empty pages).
    const DROP_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding"]);
    const resHeaders = {};
    upstream.headers.forEach((v, k) => {
      if (DROP_HEADERS.has(k.toLowerCase())) return;
      if (k.toLowerCase() === "set-cookie") {
        resHeaders[k] = rewriteSetCookie(v);
      } else {
        resHeaders[k] = v;
      }
    });

    // Handle multiple Set-Cookie headers (fetch merges them — split and rewrite each)
    const raw = upstream.headers.getSetCookie?.();
    if (raw && raw.length > 0) {
      resHeaders["set-cookie"] = raw.map(rewriteSetCookie);
    }

    res.writeHead(upstream.status, resHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    clearTimeout(timeout);
    const msg = err.name === "AbortError" ? "API proxy timeout (10s)" : "API proxy error: " + err.message;
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(msg);
  }
}

function serveLocalManifest(req, res) {
  const referer = req.headers["referer"] ?? req.headers["referrer"] ?? "";
  let pathname = "";
  try { pathname = new URL(String(referer)).pathname; } catch { /* no-op */ }

  let manifestFile;
  if (pathname.includes("/pos")) {
    manifestFile = "manifest-pos.json";
  } else if (pathname.includes("/kitchen")) {
    manifestFile = "manifest-kds.json";
  } else if (pathname.includes("/display")) {
    manifestFile = "manifest-display.json";
  } else if (pathname.startsWith("/admin")) {
    manifestFile = "manifest-admin.json";
  } else {
    manifestFile = "site.webmanifest";
  }

  const manifestPath = join(DIST, manifestFile);
  readFile(manifestPath)
    .then(content => {
      res.writeHead(200, {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
      });
      res.end(content);
    })
    .catch(() => {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Manifest not found");
    });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost`);

  if (url.pathname === "/api/manifest.webmanifest") {
    return serveLocalManifest(req, res);
  }

  if (url.pathname.startsWith("/api")) {
    return proxyApi(req, res);
  }

  let filePath = join(DIST, url.pathname);

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(DIST, "index.html");
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    const isHtml = mime.startsWith("text/html");

    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": isHtml ? "no-store" : "public, max-age=31536000, immutable",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

// TODO(store-settings): this banner is fine to leave hardcoded — server.mjs runs
// before the DB is reachable, so we can't getStoreSettings() here. Long-term, the
// banner should read the store name from a per-tenant license/config blob shipped
// alongside the binary.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Island Tacos local server on http://0.0.0.0:${PORT}`);
  console.log(`API proxied to: ${API_URL}`);
});
