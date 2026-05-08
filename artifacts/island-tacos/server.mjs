import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist", "public");
const PORT = Number(process.env.PORT ?? 3001);
const API_URL = process.env.API_SERVER_URL ?? "http://localhost:8080";

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

async function proxyApi(req, res) {
  const url = `${API_URL}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const headers = { ...req.headers };
  delete headers["host"];

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body.length > 0 ? body : undefined,
      redirect: "manual",
    });

    const resHeaders = {};
    upstream.headers.forEach((v, k) => { resHeaders[k] = v; });
    res.writeHead(upstream.status, resHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("API proxy error: " + err.message);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost`);

  // Proxy all /api requests to the API server
  if (url.pathname.startsWith("/api")) {
    return proxyApi(req, res);
  }

  let filePath = join(DIST, url.pathname);

  // Try the exact path first
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // Not found — SPA fallback to index.html so React Router handles the route
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Island Tacos local server on http://0.0.0.0:${PORT}`);
  console.log(`API proxied to: ${API_URL}`);
});
