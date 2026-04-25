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
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ origin: true, credentials: true }));
// Vapi sends the full call transcript in every tool-call request — needs a large limit
app.use("/api/vapi", express.json({ limit: "10mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

// Local mode: serve the built frontend from the same process.
// Set SERVE_STATIC_PATH to the absolute or cwd-relative path of the
// island-tacos dist/public folder (e.g. ./artifacts/island-tacos/dist/public).
const staticEnv = process.env["SERVE_STATIC_PATH"];
if (staticEnv) {
  const staticPath = path.resolve(process.cwd(), staticEnv);
  if (existsSync(staticPath)) {
    app.use(express.static(staticPath));
    // SPA fallback — send index.html for any route not matched above
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
    logger.info({ staticPath }, "Serving frontend static files");
  } else {
    logger.warn({ staticPath }, "SERVE_STATIC_PATH set but directory not found — skipping static serving");
  }
}

export default app;
