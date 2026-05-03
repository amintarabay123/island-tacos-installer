import { Router, type IRouter, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const router: IRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// Built file: artifacts/api-server/dist/downloads.mjs
// Project root is three levels up
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

// ── Installer cache ────────────────────────────────────────────────────────────
// We pre-generate the installer tar.gz to disk so we can serve it instantly
// from a createReadStream — no live streaming, no proxy timeout.
const INSTALLER_CACHE = path.join("/tmp", "island-tacos-installer-cache.tar.gz");
const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

let cacheReady = false;
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

function generateInstaller(onDone?: () => void): void {
  if (generating) return;
  generating = true;
  cacheReady = false;

  const tmp = INSTALLER_CACHE + ".tmp";
  const out = fs.createWriteStream(tmp);
  const tar = spawn("tar", ["-czf", "-", ...EXCLUDE, "."], { cwd: PROJECT_ROOT });

  tar.stdout.pipe(out);

  tar.on("error", (err) => {
    generating = false;
    console.error("[installer] tar spawn error:", err.message);
    fs.unlink(tmp, () => {});
    onDone?.();
  });

  out.on("error", (err) => {
    generating = false;
    console.error("[installer] write error:", err.message);
    tar.kill();
    fs.unlink(tmp, () => {});
    onDone?.();
  });

  tar.on("close", (code) => {
    generating = false;
    if (code !== 0) {
      console.error("[installer] tar exited with code", code);
      fs.unlink(tmp, () => {});
    } else {
      fs.rename(tmp, INSTALLER_CACHE, (err) => {
        if (err) {
          console.error("[installer] rename error:", err.message);
        } else {
          cacheReady = true;
          console.log("[installer] cache ready:", INSTALLER_CACHE);
        }
        onDone?.();
      });
    }
  });
}

function isCacheStale(): boolean {
  try {
    const stat = fs.statSync(INSTALLER_CACHE);
    return Date.now() - stat.mtimeMs > MAX_CACHE_AGE_MS;
  } catch {
    return true;
  }
}

// Pre-generate on startup
if (isCacheStale()) {
  console.log("[installer] pre-generating cache on startup...");
  generateInstaller();
} else {
  cacheReady = true;
  console.log("[installer] using existing cache:", INSTALLER_CACHE);
}

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

// Main installer archive — served from pre-generated disk cache
router.get("/download/project", (req: Request, res: Response): void => {
  const serve = () => {
    try {
      const stat = fs.statSync(INSTALLER_CACHE);
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", 'attachment; filename="island-tacos-installer.tar.gz"');
      res.setHeader("Content-Length", stat.size.toString());
      res.setHeader("Cache-Control", "no-store");
      const stream = fs.createReadStream(INSTALLER_CACHE);
      stream.pipe(res);
      stream.on("error", (err) => {
        if (!res.headersSent) res.status(500).send("Read error: " + err.message);
      });
      req.on("close", () => stream.destroy());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send("Installer not available: " + msg);
    }
  };

  if (cacheReady) {
    serve();
    // Trigger background refresh if stale
    if (isCacheStale()) generateInstaller();
    return;
  }

  // Cache not ready yet — wait for it (up to 5 min) then serve
  const deadline = Date.now() + 5 * 60 * 1000;
  const poll = setInterval(() => {
    if (cacheReady) {
      clearInterval(poll);
      serve();
    } else if (Date.now() > deadline) {
      clearInterval(poll);
      res.status(503).send("Installer is still being prepared. Please retry in a minute.");
    }
  }, 2000);

  req.on("close", () => clearInterval(poll));
});

export default router;
