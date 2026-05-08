import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import { existsSync } from "fs";

const app: Express = express();

// Gzip all responses — biggest single win for slow connections
app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must come before body parsers (streams raw bytes)
// Only activate when CLERK_SECRET_KEY is configured (not on local-only installs)
if (process.env.CLERK_SECRET_KEY) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(cors({ origin: true, credentials: true }));
// Sales import can be several MB
app.use("/api/admin/import-sales", express.json({ limit: "50mb" }));
app.use(express.json({
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}

app.use("/api", router);
// If a BASE_PATH is set (local install), also handle BASE_PATH/api/* so that
// the Vite-built frontend (which prefixes BASE_URL to all fetch calls) can
// reach the API without the requests falling through to the SPA fallback.
const runtimeBasePath = (process.env["BASE_PATH"] ?? "").replace(/\/$/, "");
if (runtimeBasePath) {
  app.use(`${runtimeBasePath}/api`, router);
}

// Local mode: serve the built frontend from the same process.
// SERVE_STATIC_PATH  — path to the island-tacos dist/public folder
// BASE_PATH          — the URL prefix the frontend was built with (e.g. /it-dav7dwn8)
//
// Mounted at BOTH basePath and root "/" so the server handles:
//   - New builds: assets at /it-dav7dwn8/assets/... (via basePath mount)
//   - Old builds: assets at /assets/...             (via root mount)
const staticEnv = process.env["SERVE_STATIC_PATH"];
if (staticEnv) {
  const staticPath = path.resolve(process.cwd(), staticEnv);
  const basePath = (process.env["BASE_PATH"] ?? "").replace(/\/$/, "");
  if (existsSync(staticPath)) {
    // Mount at base path prefix for builds that embed the prefix in asset URLs
    if (basePath) {
      app.use(basePath, express.static(staticPath));
    }
    // Always mount at root — catches /assets/... from older builds and
    // any direct root navigation (e.g. http://ip:3001/)
    app.use(express.static(staticPath));
    // SPA fallback — any route not matched above gets index.html
    app.use((_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
    logger.info({ staticPath, basePath: basePath || "/" }, "Serving frontend static files");
  } else {
    logger.warn({ staticPath }, "SERVE_STATIC_PATH set but directory not found — skipping static serving");
  }
}

export default app;
