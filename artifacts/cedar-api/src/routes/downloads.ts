import { Router, type IRouter, type Request, type Response } from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { objectStorageClient, signObjectGetURL } from "../lib/objectStorage";
import { pool } from "@workspace/db";
import { requireAdminAuth } from "./auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// Built file: artifacts/api-server/dist/downloads.mjs
// Project root is three levels up
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

// ── Installer — GCS-backed public file ────────────────────────────────────────
// 1. We generate the tar.gz to disk on startup (or on first request).
// 2. We upload it to GCS and make it publicly readable.
// 3. The download route does a 302 redirect to the GCS URL.
//    This completely bypasses the Replit reverse proxy size limit.

const INSTALLER_CACHE   = path.join(os.tmpdir(), "island-tacos-installer-cache.tar.gz");
const GCS_OBJECT_NAME   = "installer/island-tacos-installer.tar.gz";
const MAX_CACHE_AGE_MS  = 12 * 60 * 60 * 1000; // 12 hours

let gcsPublicUrl: string | null = null;
let generating = false;

// ── Frontend dist — GCS-backed (bypasses Replit proxy size limit) ─────────────
// The actual upload happens in the island-tacos build's postbuild step.
// See the long comment above initFrontendCache() below.
const FRONTEND_GCS_OBJECT   = "installer/island-tacos-frontend.tar.gz";

let frontendGcsUrl: string | null = null;

const EXCLUDE = [
  "--exclude=./.git",
  "--exclude=*/node_modules",
  "--exclude=./.local",
  "--exclude=./.cache",
  "--exclude=*/dist",
  "--exclude=*.log",
  "--exclude=*.map",
  "--exclude=./attached_assets",
  "--exclude=./artifacts/island-tacos/public/island-tacos-installer.tar.gz",
  "--exclude=./artifacts/mockup-sandbox",
  "--exclude=./screenshots",
];

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

async function generateAndUpload(): Promise<void> {
  if (generating) return;
  generating = true;
  gcsPublicUrl = null;

  logger.info("[installer] generating archive...");

  try {
    // Step 1: write archive to disk
    await new Promise<void>((resolve, reject) => {
      const tmp = INSTALLER_CACHE + ".tmp";
      const out = fs.createWriteStream(tmp);
      // windowsHide: true prevents a brief console window flashing on Windows
      // whenever the server restarts (e.g. on the shop mini PC).
      const tar = spawn("tar", ["-czf", "-", ...EXCLUDE, "."], { cwd: PROJECT_ROOT, windowsHide: true });

      tar.stdout.pipe(out);
      // Drain stderr so the buffer never fills and the process never hangs
      tar.stderr.resume();

      out.on("error", (err) => {
        tar.kill();
        fs.unlink(tmp, () => {});
        reject(err);
      });

      tar.on("error", (err) => {
        fs.unlink(tmp, () => {});
        reject(err);
      });

      tar.on("close", (code) => {
        if (code !== 0) {
          fs.unlink(tmp, () => {});
          reject(new Error(`tar exited with code ${code}`));
          return;
        }
        fs.rename(tmp, INSTALLER_CACHE, (err) => {
          if (err) reject(err); else resolve();
        });
      });
    });

    logger.info("[installer] archive ready, uploading to GCS...");

    // Step 2: upload to GCS — stream from disk to avoid loading the full
    // archive (~50+ MB) into memory, which OOM-kills the deployment.
    const bucket = getBucket();
    const file = bucket.file(GCS_OBJECT_NAME);
    await pipeline(
      fs.createReadStream(INSTALLER_CACHE),
      file.createWriteStream({
        resumable: false,
        metadata: {
          contentType: "application/gzip",
          contentDisposition: 'attachment; filename="island-tacos-installer.tar.gz"',
        },
      }),
    );

    // Step 3: generate a signed GET URL (7 days) — bypasses Replit proxy, no public ACL needed
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
    gcsPublicUrl = await signObjectGetURL(bucketId, GCS_OBJECT_NAME, 7 * 24 * 3600);
    logger.info({ url: gcsPublicUrl }, "[installer] available");

  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "[installer] error");
  } finally {
    generating = false;
  }
}

// On startup: immediately sign a URL for the existing GCS object (if any) so downloads
// are available right away, then always regenerate a fresh archive in the background
// so the archive stays in sync with the latest deployed source.
async function initInstallerCache(): Promise<void> {
  let gcsReachable = false;
  try {
    const bucket = getBucket();
    const file = bucket.file(GCS_OBJECT_NAME);
    const [exists] = await file.exists();
    gcsReachable = true; // only set if no exception thrown above
    if (exists) {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
      gcsPublicUrl = await signObjectGetURL(bucketId, GCS_OBJECT_NAME, 7 * 24 * 3600);
      logger.info("[installer] existing GCS object signed — regenerating fresh archive in background...");
    }
  } catch {
    // No existing object or GCS unavailable (e.g. shop mini PC has bucket ID in .env
    // but no service-account credentials) — gcsReachable stays false, skip generation.
  }

  // Only regenerate on hosts where GCS is actually reachable (cloud deployment).
  // The shop mini PC has DEFAULT_OBJECT_STORAGE_BUCKET_ID in its .env but has no
  // GCS service-account credentials, so the file.exists() call above will throw
  // (ECONNREFUSED to 127.0.0.1:1106). We track that with gcsReachable so we don't
  // spawn tar on the mini PC — that would flash a console window on every restart.
  if (!gcsReachable) {
    logger.info("[installer] skipping archive generation (GCS unreachable — likely shop mini PC)");
    return;
  }

  // Always regenerate on startup so the archive matches the current deployment
  generateAndUpload().catch((err) => {
    logger.error({ err }, "[installer] background generation failed");
  });
}

// Kick off on startup (don't await — non-blocking)
initInstallerCache().catch((err) => logger.error({ err }, "[installer] initInstallerCache failed"));

// On startup: sign the existing GCS frontend object (if any) so /api/download/frontend
// can serve it immediately. The api-server NEVER regenerates this archive itself —
// in multi-artifact deployments the frontend's `dist/public/` does not exist on the
// api-server's filesystem, so any tar attempt here would silently fail and leave the
// GCS object stale. Regeneration is owned by the island-tacos build's `postbuild`
// step (artifacts/island-tacos/scripts/upload-tarball.mjs), which runs in the
// frontend artifact's container where dist/public is guaranteed present.
async function initFrontendCache(): Promise<void> {
  try {
    const bucket = getBucket();
    const file = bucket.file(FRONTEND_GCS_OBJECT);
    const [exists] = await file.exists();
    if (exists) {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
      frontendGcsUrl = await signObjectGetURL(bucketId, FRONTEND_GCS_OBJECT, 7 * 24 * 3600);
      logger.info("[frontend] existing GCS object signed — fresh tarball is uploaded by the island-tacos build's postbuild step.");
    } else {
      logger.warn("[frontend] no GCS object found — UPDATE.bat will fail until the next island-tacos deploy regenerates it.");
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "[frontend] init failed");
  }
}

initFrontendCache().catch((err) => logger.error({ err }, "[frontend] initFrontendCache failed"));

// ── Helpers ────────────────────────────────────────────────────────────────────
function serveFile(filePath: string, filename: string, contentType: string) {
  return (_req: Request, res: Response): void => {
    const full = path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(full)) {
      res.status(404).send("File not found");
      return;
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(full));
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get("/download/INSTALL.bat",          serveFile("INSTALL.bat",                          "INSTALL.bat",          "text/plain; charset=utf-8"));
router.get("/download/INSTALL.ps1",          serveFile("INSTALL.ps1",                          "INSTALL.ps1",          "text/plain; charset=utf-8"));
router.get("/download/install.sh",           serveFile("install.sh",                           "install.sh",           "text/plain; charset=utf-8"));
router.get("/download/UPDATE.bat",           serveFile("UPDATE.bat",                           "UPDATE.bat",           "text/plain; charset=utf-8"));
router.get("/download/UPDATE.ps1",           serveFile("UPDATE.ps1",                           "UPDATE.ps1",           "text/plain; charset=utf-8"));
router.get("/download/ecosystem.config.cjs", serveFile("local-install/ecosystem.config.cjs",   "ecosystem.config.cjs", "text/plain; charset=utf-8"));
router.get("/download/monitor.mjs",          serveFile("local-install/monitor.mjs",             "monitor.mjs",          "text/plain; charset=utf-8"));
router.get("/download/menu-import.sql",      serveFile("local-install/menu-import.sql",         "menu-import.sql",      "text/plain; charset=utf-8"));
router.get("/download/menu-patch.sql",       serveFile("local-install/menu-patch.sql",          "menu-patch.sql",       "text/plain; charset=utf-8"));
router.get("/download/server",               serveFile("artifacts/api-server/dist/index.mjs",   "index.mjs",            "application/octet-stream"));

// Frontend dist download — GCS-backed signed URL (bypasses Replit proxy size limit).
// The GCS object is written by the island-tacos build's postbuild step; this route
// only signs it. If the cached signed URL is missing (startup signing failed, or
// transient bucket error), try once on-demand instead of waiting for a server
// restart — otherwise the mini PC's UPDATE.bat would 503 indefinitely.
router.get("/download/frontend", async (_req: Request, res: Response): Promise<void> => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (frontendGcsUrl) { res.json({ url: frontendGcsUrl }); return; }

  try {
    const bucket = getBucket();
    const file = bucket.file(FRONTEND_GCS_OBJECT);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(503).json({ error: "Frontend tarball not found in object storage. Trigger a deploy of the island-tacos artifact to regenerate it." });
      return;
    }
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
    frontendGcsUrl = await signObjectGetURL(bucketId, FRONTEND_GCS_OBJECT, 7 * 24 * 3600);
    res.json({ url: frontendGcsUrl });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "[frontend] on-demand sign failed");
    res.status(503).json({ error: "Frontend tarball signing failed. Please retry shortly." });
  }
});
// Pre-filled .env — requires { pin: ADMIN_PIN } in the JSON request body.
// Uses POST (not GET) so the PIN does not appear in URLs, proxy logs, browser
// history, or referer headers. Injects all known secrets so the local server
// needs no manual editing after install.
router.post("/download/env", (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as { pin?: unknown };
  const pin = typeof body.pin === "string" ? body.pin : undefined;
  if (!pin || pin !== process.env.ADMIN_PIN) {
    res.status(401).json({ error: "Invalid or missing pin" });
    return;
  }

  const ip        = process.env.LOCAL_SERVER_IP ?? "192.168.132.100";
  const port      = "3001";
  const publicUrl = `http://${ip}:${port}`;

  const storeTitle = process.env.STORE_TITLE ?? "Cedar Cafe";
  const dbUser  = process.env.LOCAL_DB_USER  ?? "ccuser";
  const dbName  = process.env.LOCAL_DB_NAME  ?? "cedarcafe";
  const staticPath = process.env.LOCAL_SERVE_STATIC_PATH ?? "./artifacts/cedar-cafe/dist/public";
  const syncUrl = process.env.STORE_URL ?? "";

  const env = [
    `# ${storeTitle} — Local Server Configuration (pre-filled by cloud server)`,
    "# Generated: " + new Date().toISOString(),
    "",
    "# ── PostgreSQL ──────────────────────────────────────────────────────────────",
    "# Replace YOUR_DB_PASSWORD with your PostgreSQL password",
    `DATABASE_URL=postgresql://${dbUser}:YOUR_DB_PASSWORD@localhost:5432/${dbName}`,
    "",
    "# ── Server ───────────────────────────────────────────────────────────────────",
    `PORT=${port}`,
    "NODE_ENV=production",
    `PUBLIC_URL=${publicUrl}`,
    `SERVE_STATIC_PATH=${staticPath}`,
    "",
    "# ── Security ─────────────────────────────────────────────────────────────────",
    `SESSION_SECRET=${process.env.SESSION_SECRET ?? ""}`,
    `ADMIN_PIN=${process.env.ADMIN_PIN ?? ""}`,
    `STAFF_PIN=${process.env.STAFF_PIN ?? ""}`,
    "",
    "# ── ATH Móvil ────────────────────────────────────────────────────────────────",
    `ATHMOVIL_PUBLIC_TOKEN=${process.env.ATHMOVIL_PUBLIC_TOKEN ?? ""}`,
    `ATHMOVIL_PRIVATE_TOKEN=${process.env.ATHMOVIL_PRIVATE_TOKEN ?? ""}`,
    "",
    "# ── Email ────────────────────────────────────────────────────────────────────",
    `SMTP_PASSWORD=${process.env.SMTP_PASSWORD ?? ""}`,
    "SMTP_HOST=smtp.gmail.com",
    "SMTP_PORT=587",
    `SMTP_USER=${process.env.SMTP_USER ?? ""}`,
    "",
    "# ── Object Storage ───────────────────────────────────────────────────────────",
    `DEFAULT_OBJECT_STORAGE_BUCKET_ID=${process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? ""}`,
    `PRIVATE_OBJECT_DIR=${process.env.PRIVATE_OBJECT_DIR ?? ""}`,
    `PUBLIC_OBJECT_SEARCH_PATHS=${process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? ""}`,
    "",
    "# ── Cloud Sync ───────────────────────────────────────────────────────────────",
    `SYNC_TARGET_URL=${syncUrl}`,
    `SYNC_SECRET=${process.env.SYNC_SECRET ?? ""}`,
    "",
    "# ── Loyverse ─────────────────────────────────────────────────────────────────",
    `LOYVERSE_API_TOKEN=${process.env.LOYVERSE_API_TOKEN ?? ""}`,
    "",
    "# ── SMS Gateway (Android phone with BVI SIM running sms-gate.app) ────────────",
    `SMS_GATEWAY_URL=${process.env.SMS_GATEWAY_URL ?? ""}`,
    `SMS_GATEWAY_USERNAME=${process.env.SMS_GATEWAY_USERNAME ?? ""}`,
    `SMS_GATEWAY_PASSWORD=${process.env.SMS_GATEWAY_PASSWORD ?? ""}`,
    "",
    "# ── Monitor alerts — phone numbers to notify when the POS goes down ──────────",
    "# E.164 format, e.g. +12845448088  (the number that RECEIVES the alert)",
    `MONITOR_ALERT_PHONE=${process.env.MONITOR_ALERT_PHONE ?? ""}`,
    "# WhatsApp number if different from MONITOR_ALERT_PHONE (leave blank to reuse above)",
    `MONITOR_ALERT_WA_PHONE=${process.env.MONITOR_ALERT_WA_PHONE ?? ""}`,
    "",
    "# ── Twilio (fallback only — used when SMS_GATEWAY_* is unset/unreachable) ────",
    `TWILIO_ACCOUNT_SID=${process.env.TWILIO_ACCOUNT_SID ?? ""}`,
    `TWILIO_AUTH_TOKEN=${process.env.TWILIO_AUTH_TOKEN ?? ""}`,
    "",
    "# ── OpenAI ───────────────────────────────────────────────────────────────────",
    `OPENAI_API_KEY=${process.env.OPENAI_API_KEY ?? ""}`,
    "",
    "# ── Local IP (used for ATH webhook registration) ─────────────────────────────",
    `LOCAL_SERVER_IP=${ip}`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename=".env"');
  res.send(env);
});

// ── Android Customer Display APK ──────────────────────────────────────────────
// Built from android-customer-display/ source, served directly (small file ~3 MB).
// No auth required — it's a debug APK for internal use only.
router.get("/download/customer-display.apk", (_req: Request, res: Response): void => {
  const candidates = [
    path.join(PROJECT_ROOT, "android-customer-display", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    path.join(PROJECT_ROOT, "artifacts", "api-server", "public", "customer-display.apk"),
  ];
  const apkPath = candidates.find(p => fs.existsSync(p));
  if (!apkPath) {
    res.status(404).json({ error: "APK not yet built. Ask the system admin to rebuild it." });
    return;
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", 'attachment; filename="island-tacos-customer-display.apk"');
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(apkPath);
});

router.get("/download/FIXDB.ps1",            serveFile("local-install/FIXDB.ps1",               "FIXDB.ps1",            "text/plain; charset=utf-8"));
router.get("/download/FIXDB.bat",            serveFile("local-install/FIXDB.bat",               "FIXDB.bat",            "text/plain; charset=utf-8"));
router.get("/download/modifier-links.sql",   serveFile("local-install/modifier-links.sql",      "modifier-links.sql",   "text/plain; charset=utf-8"));
router.get("/download/REINSTALL.ps1",        serveFile("local-install/REINSTALL.ps1",           "REINSTALL.ps1",        "text/plain; charset=utf-8"));
router.get("/download/schema.sql",           serveFile("local-install/schema.sql",              "schema.sql",           "text/plain; charset=utf-8"));
router.get("/download/migrate.mjs",          serveFile("local-install/migrate.mjs",             "migrate.mjs",          "text/plain; charset=utf-8"));
router.get("/download/update-ip.ps1",        serveFile("local-install/update-ip.ps1",           "update-ip.ps1",        "text/plain; charset=utf-8"));
router.get("/download/update-ip.bat",        serveFile("local-install/update-ip.bat",           "update-ip.bat",        "text/plain; charset=utf-8"));
router.get("/download/import-sales",         serveFile("local-install/import-sales.cjs",        "import-sales.cjs",     "text/plain; charset=utf-8"));

router.get("/download/setup-guide", (_req: Request, res: Response): void => {
  const full = path.join(PROJECT_ROOT, "artifacts", "island-tacos", "public", "docs", "install-guide.html");
  if (!fs.existsSync(full)) { res.status(404).send("Not found"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(fs.readFileSync(full, "utf-8"));
});

// Returns the direct GCS download URL as JSON — client downloads from GCS directly,
// bypassing the Replit proxy entirely (the proxy transparently follows 302s and hits size limits).
// PowerShell usage: $u=(iwr "…/api/download/project-url"|ConvertFrom-Json).url; iwr $u -OutFile …
router.get("/download/project-url", (req: Request, res: Response): void => {
  const send = () => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ url: gcsPublicUrl });
  };

  if (gcsPublicUrl) { send(); return; }

  const deadline = Date.now() + 5 * 60 * 1000;
  const poll = setInterval(() => {
    if (gcsPublicUrl) { clearInterval(poll); send(); }
    else if (Date.now() > deadline) {
      clearInterval(poll);
      res.status(503).json({ error: "Installer is still being prepared. Please retry in a minute." });
    }
  }, 3000);
  req.on("close", () => clearInterval(poll));
});

// ── Sales data export (JSON) ───────────────────────────────────────────────────
// Returns all sales data as JSON. Use with the import-sales.cjs script.
// Download: Invoke-WebRequest -Uri ".../api/download/sales-export" -OutFile sales-export.json
// Import:   node import-sales.cjs sales-export.json

router.get("/download/sales-export", requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await pool.connect();
    try {
      const [ord, items, shifts, cashTxns, refunds] = await Promise.all([
        client.query("SELECT * FROM orders ORDER BY id"),
        client.query("SELECT * FROM order_items ORDER BY id"),
        client.query("SELECT * FROM shifts ORDER BY id"),
        client.query("SELECT * FROM cash_transactions ORDER BY id"),
        client.query("SELECT * FROM refunds ORDER BY id"),
      ]);

      const payload = {
        generatedAt: new Date().toISOString(),
        orders: ord.rows,
        order_items: items.rows,
        shifts: shifts.rows,
        cash_transactions: cashTxns.rows,
        refunds: refunds.rows,
      };

      const filename = `island-tacos-sales-${payload.generatedAt.slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(payload, null, 2));
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Export failed", detail: msg });
  }
});

// Legacy redirect endpoint (kept for backwards compat, but proxy intercepts it — prefer /project-url)
router.get("/download/project", (req: Request, res: Response): void => {
  if (gcsPublicUrl) { res.redirect(302, gcsPublicUrl); return; }

  const deadline = Date.now() + 5 * 60 * 1000;
  const poll = setInterval(() => {
    if (gcsPublicUrl) { clearInterval(poll); res.redirect(302, gcsPublicUrl); }
    else if (Date.now() > deadline) {
      clearInterval(poll);
      res.status(503).send("Installer is still being prepared. Please retry in a minute.");
    }
  }, 3000);
  req.on("close", () => clearInterval(poll));
});

// GET /api/download/run-import?file=C:\path\to\sales-export.json
// Localhost-only — reads the file from disk and inserts into the local DB
router.get("/download/run-import", async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || "";
  const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocal) {
    res.status(403).json({ error: "Only accessible from localhost" });
    return;
  }

  const filePath = req.query.file as string;
  if (!filePath) {
    res.status(400).json({ error: "Missing ?file= query parameter" });
    return;
  }

  let data: Record<string, unknown[]>;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    data = JSON.parse(raw) as Record<string, unknown[]>;
  } catch (err) {
    res.status(400).json({ error: `Cannot read file: ${String(err)}` });
    return;
  }

  const tables = ["shifts", "cash_transactions", "orders", "order_items", "refunds"] as const;
  const counts: Record<string, number> = {};
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (const table of tables) {
      const rows = (data[table] as Record<string, unknown>[]) || [];
      let inserted = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const values = cols.map((c) => {
          const v = row[c];
          // JSONB columns need explicit JSON string — pg would otherwise serialize
          // arrays/objects as PostgreSQL array literals which JSONB rejects
          if (v !== null && typeof v === "object") return JSON.stringify(v);
          return v;
        });
        await client.query(
          `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
          values
        );
        inserted++;
      }
      counts[table] = inserted;
    }
    await client.query("COMMIT");
    res.json({ ok: true, counts });
  } catch (err) {
    await client.query("ROLLBACK");
    req.log.error({ err }, "import-sales failed");
    res.status(500).json({ error: String(err) });
  } finally {
    client.release();
  }
});

// ── server.mjs proxy download ──────────────────────────────────────────────────
// Windows machines can download the latest server.mjs via:
//   Invoke-WebRequest "$CLOUD/api/download/server.mjs" -OutFile server.mjs
router.get("/download/server.mjs", (req: Request, res: Response): void => {
  const serverPath = path.resolve(PROJECT_ROOT, "artifacts", "island-tacos", "server.mjs");
  if (!fs.existsSync(serverPath)) {
    res.status(404).json({ error: "server.mjs not found" });
    return;
  }
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Content-Disposition", 'attachment; filename="server.mjs"');
  res.send(fs.readFileSync(serverPath, "utf-8"));
});

// ── Run UPDATE.ps1 on the shop mini PC ────────────────────────────────────────
// POST /api/admin/run-update  (admin auth, Windows only)
//
// Responds 202 BEFORE spawning the script because UPDATE.ps1 calls
// `pm2 restart` which kills this very process before it finishes.
// Spawn detached + unref so the child outlives the parent process.
router.post("/admin/run-update", requireAdminAuth, (req: Request, res: Response): void => {
  if (process.platform !== "win32") {
    res.status(501).json({ ok: false, error: "Software update is only available on the shop mini PC (Windows)." });
    return;
  }

  const scriptPath = path.join(PROJECT_ROOT, "UPDATE.ps1");
  if (!fs.existsSync(scriptPath)) {
    res.status(404).json({ ok: false, error: "UPDATE.ps1 not found in the install directory. Re-run REINSTALL.ps1 to restore it." });
    return;
  }

  // Flush response BEFORE the spawn — pm2 restart will kill this process.
  res.status(202).json({ ok: true, message: "Update script started. Server will restart momentarily." });

  // 300 ms grace period so Express can flush the response headers/body.
  setTimeout(() => {
    const child = spawn(
      "powershell.exe",
      ["-ExecutionPolicy", "Bypass", "-NonInteractive", "-File", scriptPath],
      { cwd: PROJECT_ROOT, detached: true, stdio: "ignore", windowsHide: true },
    );
    child.unref();
    logger.info({ scriptPath }, "[update] UPDATE.ps1 launched detached");
  }, 300);
});

export default router;
