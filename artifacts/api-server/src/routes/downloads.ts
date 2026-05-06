import { Router, type IRouter, type Request, type Response } from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { objectStorageClient, signObjectGetURL } from "../lib/objectStorage";
import { pool } from "@workspace/db";

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
const FRONTEND_CACHE        = path.join(os.tmpdir(), "island-tacos-frontend-cache.tar.gz");
const FRONTEND_GCS_OBJECT   = "installer/island-tacos-frontend.tar.gz";

let frontendGcsUrl: string | null = null;
let frontendGenerating = false;

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

  console.log("[installer] generating archive...");

  try {
    // Step 1: write archive to disk
    await new Promise<void>((resolve, reject) => {
      const tmp = INSTALLER_CACHE + ".tmp";
      const out = fs.createWriteStream(tmp);
      const tar = spawn("tar", ["-czf", "-", ...EXCLUDE, "."], { cwd: PROJECT_ROOT });

      tar.stdout.pipe(out);

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

    console.log("[installer] archive ready, uploading to GCS...");

    // Step 2: upload to GCS
    const bucket = getBucket();
    const file = bucket.file(GCS_OBJECT_NAME);
    await file.save(fs.readFileSync(INSTALLER_CACHE), {
      metadata: {
        contentType: "application/gzip",
        contentDisposition: 'attachment; filename="island-tacos-installer.tar.gz"',
      },
    });

    // Step 3: generate a signed GET URL (7 days) — bypasses Replit proxy, no public ACL needed
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
    gcsPublicUrl = await signObjectGetURL(bucketId, GCS_OBJECT_NAME, 7 * 24 * 3600);
    console.log("[installer] available at:", gcsPublicUrl);

  } catch (err) {
    console.error("[installer] error:", err instanceof Error ? err.message : err);
  } finally {
    generating = false;
  }
}

// On startup: immediately sign a URL for the existing GCS object (if any) so downloads
// are available right away, then always regenerate a fresh archive in the background
// so the archive stays in sync with the latest deployed source.
async function initInstallerCache(): Promise<void> {
  try {
    const bucket = getBucket();
    const file = bucket.file(GCS_OBJECT_NAME);
    const [exists] = await file.exists();
    if (exists) {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
      gcsPublicUrl = await signObjectGetURL(bucketId, GCS_OBJECT_NAME, 7 * 24 * 3600);
      console.log("[installer] existing GCS object signed — regenerating fresh archive in background...");
    }
  } catch {
    // No existing object or GCS unavailable — will generate fresh
  }

  // Always regenerate on startup so the archive matches the current deployment
  generateAndUpload().catch((err) => {
    console.error("[installer] background generation failed:", err);
  });
}

// Kick off on startup (don't await — non-blocking)
initInstallerCache().catch(console.error);

async function generateAndUploadFrontend(): Promise<void> {
  if (frontendGenerating) return;
  frontendGenerating = true;
  frontendGcsUrl = null;

  console.log("[frontend] generating archive...");

  const distDir = path.join(PROJECT_ROOT, "artifacts", "island-tacos", "dist", "public");

  try {
    await new Promise<void>((resolve, reject) => {
      const tmp = FRONTEND_CACHE + ".tmp";
      const out = fs.createWriteStream(tmp);
      const tar = spawn("tar", [
        "-czf", "-",
        "-C", distDir,
        "--exclude=./island-tacos-installer.tar.gz", // 51 MB — not needed on mini PC
        "--exclude=./docs",                          // install docs — not needed at runtime
        ".",
      ]);

      tar.stdout.pipe(out);

      out.on("error", (err) => { tar.kill(); fs.unlink(tmp, () => {}); reject(err); });
      tar.on("error", (err) => { fs.unlink(tmp, () => {}); reject(err); });
      tar.on("close", (code) => {
        if (code !== 0) { fs.unlink(tmp, () => {}); reject(new Error(`tar exited ${code}`)); return; }
        fs.rename(tmp, FRONTEND_CACHE, (err) => { if (err) reject(err); else resolve(); });
      });
    });

    console.log("[frontend] archive ready, uploading to GCS...");

    const bucket = getBucket();
    const file = bucket.file(FRONTEND_GCS_OBJECT);
    await file.save(fs.readFileSync(FRONTEND_CACHE), {
      metadata: {
        contentType: "application/gzip",
        contentDisposition: 'attachment; filename="island-tacos-frontend.tar.gz"',
      },
    });

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
    frontendGcsUrl = await signObjectGetURL(bucketId, FRONTEND_GCS_OBJECT, 7 * 24 * 3600);
    console.log("[frontend] available at:", frontendGcsUrl);

  } catch (err) {
    console.error("[frontend] error:", err instanceof Error ? err.message : err);
  } finally {
    frontendGenerating = false;
  }
}

async function initFrontendCache(): Promise<void> {
  try {
    const bucket = getBucket();
    const file = bucket.file(FRONTEND_GCS_OBJECT);
    const [exists] = await file.exists();
    if (exists) {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
      frontendGcsUrl = await signObjectGetURL(bucketId, FRONTEND_GCS_OBJECT, 7 * 24 * 3600);
      console.log("[frontend] existing GCS object signed — regenerating in background...");
    }
  } catch {
    // No existing object or GCS unavailable — will generate fresh
  }

  generateAndUploadFrontend().catch((err) => {
    console.error("[frontend] background generation failed:", err);
  });
}

initFrontendCache().catch(console.error);

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
router.get("/download/menu-import.sql",      serveFile("local-install/menu-import.sql",         "menu-import.sql",      "text/plain; charset=utf-8"));
router.get("/download/menu-patch.sql",       serveFile("local-install/menu-patch.sql",          "menu-patch.sql",       "text/plain; charset=utf-8"));
router.get("/download/server",               serveFile("artifacts/api-server/dist/index.mjs",   "index.mjs",            "application/octet-stream"));

// Frontend dist download — GCS-backed signed URL (bypasses Replit proxy size limit)
router.get("/download/frontend", (req: Request, res: Response): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (frontendGcsUrl) { res.json({ url: frontendGcsUrl }); return; }

  const deadline = Date.now() + 5 * 60 * 1000;
  const poll = setInterval(() => {
    if (frontendGcsUrl) { clearInterval(poll); res.json({ url: frontendGcsUrl }); }
    else if (Date.now() > deadline) {
      clearInterval(poll);
      res.status(503).json({ error: "Frontend is still being prepared. Please retry in a minute." });
    }
  }, 3000);
  req.on("close", () => clearInterval(poll));
});
// Pre-filled .env — requires ?pin=ADMIN_PIN query param
// Injects all known secrets so the local server needs no manual editing
router.get("/download/env", (req: Request, res: Response): void => {
  const pin = req.query.pin as string | undefined;
  if (!pin || pin !== process.env.ADMIN_PIN) {
    res.status(401).json({ error: "Invalid or missing pin" });
    return;
  }

  const ip        = process.env.LOCAL_SERVER_IP ?? "192.168.132.100";
  const port      = "3001";
  const publicUrl = `http://${ip}:${port}`;

  const env = [
    "# Island Tacos — Local Server Configuration (pre-filled by cloud server)",
    "# Generated: " + new Date().toISOString(),
    "",
    "# ── PostgreSQL ──────────────────────────────────────────────────────────────",
    "# Replace YOUR_DB_PASSWORD with your PostgreSQL password",
    "DATABASE_URL=postgresql://ituser:YOUR_DB_PASSWORD@localhost:5432/islandtacos",
    "",
    "# ── Server ───────────────────────────────────────────────────────────────────",
    `PORT=${port}`,
    "NODE_ENV=production",
    `PUBLIC_URL=${publicUrl}`,
    "SERVE_STATIC_PATH=./artifacts/island-tacos/dist/public",
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
    `SMTP_USER=${process.env.SMTP_USER ?? "orders@islandtacosbvi.com"}`,
    "",
    "# ── Object Storage ───────────────────────────────────────────────────────────",
    `DEFAULT_OBJECT_STORAGE_BUCKET_ID=${process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? ""}`,
    `PRIVATE_OBJECT_DIR=${process.env.PRIVATE_OBJECT_DIR ?? ""}`,
    `PUBLIC_OBJECT_SEARCH_PATHS=${process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? ""}`,
    "",
    "# ── Cloud Sync ───────────────────────────────────────────────────────────────",
    "SYNC_TARGET_URL=https://orders.islandtacosbvi.com",
    `SYNC_SECRET=${process.env.SYNC_SECRET ?? ""}`,
    "",
    "# ── Vapi (AI Phone) ──────────────────────────────────────────────────────────",
    `VAPI_API_KEY=${process.env.VAPI_API_KEY ?? ""}`,
    `VAPI_WEBHOOK_SECRET=${process.env.VAPI_WEBHOOK_SECRET ?? ""}`,
    "",
    "# ── Loyverse ─────────────────────────────────────────────────────────────────",
    `LOYVERSE_API_TOKEN=${process.env.LOYVERSE_API_TOKEN ?? ""}`,
    "",
    "# ── Twilio ───────────────────────────────────────────────────────────────────",
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

router.get("/download/modifier-links.sql",   serveFile("local-install/modifier-links.sql",      "modifier-links.sql",   "text/plain; charset=utf-8"));
router.get("/download/REINSTALL.ps1",        serveFile("local-install/REINSTALL.ps1",           "REINSTALL.ps1",        "text/plain; charset=utf-8"));
router.get("/download/schema.sql",           serveFile("local-install/schema.sql",              "schema.sql",           "text/plain; charset=utf-8"));
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

router.get("/download/sales-export", async (req: Request, res: Response): Promise<void> => {
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

export default router;
