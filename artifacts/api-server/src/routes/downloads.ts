import { Router, type IRouter, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { objectStorageClient, signObjectGetURL } from "../lib/objectStorage";

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

const INSTALLER_CACHE   = path.join("/tmp", "island-tacos-installer-cache.tar.gz");
const GCS_OBJECT_NAME   = "installer/island-tacos-installer.tar.gz";
const MAX_CACHE_AGE_MS  = 12 * 60 * 60 * 1000; // 12 hours

let gcsPublicUrl: string | null = null;
let generating = false;

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

router.get("/download/INSTALL.bat", serveFile("INSTALL.bat", "INSTALL.bat", "application/octet-stream"));
router.get("/download/INSTALL.ps1", serveFile("INSTALL.ps1", "INSTALL.ps1", "application/octet-stream"));
router.get("/download/install.sh",  serveFile("install.sh",  "install.sh",  "application/octet-stream"));

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

export default router;
