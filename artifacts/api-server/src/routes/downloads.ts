import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const router: IRouter = Router();

// Resolve project root from the compiled file location
// Built file lives at: artifacts/api-server/dist/downloads.mjs
// Project root is three levels up: dist/ → api-server/ → artifacts/ → workspace/
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

function serveFile(filePath: string, filename: string, contentType: string) {
  return (_req: import("express").Request, res: import("express").Response): void => {
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

// Windows installer — double-click to run
router.get("/download/INSTALL.bat", serveFile("INSTALL.bat", "INSTALL.bat", "application/octet-stream"));

// Windows PowerShell installer (called by INSTALL.bat)
router.get("/download/INSTALL.ps1", serveFile("INSTALL.ps1", "INSTALL.ps1", "application/octet-stream"));

// Linux installer
router.get("/download/install.sh", serveFile("install.sh", "install.sh", "application/octet-stream"));

// Printable setup guide (HTML)
router.get("/download/setup-guide", (_req, res): void => {
  const full = path.join(PROJECT_ROOT, "artifacts", "island-tacos", "public", "docs", "install-guide.html");
  if (!fs.existsSync(full)) { res.status(404).send("Not found"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(fs.readFileSync(full, "utf-8"));
});

// Full project download — streams a fresh tar.gz of the source code (excludes node_modules, dist, .git)
// Windows 10/11 can open .tar.gz natively (right-click → Extract All), or use 7-Zip/WinRAR
router.get("/download/project", (req, res): void => {
  const filename = "island-tacos-project.tar.gz";
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const exclude = [
    "--exclude=./.git",
    "--exclude=*/node_modules",
    "--exclude=./.local",
    "--exclude=*/dist",
    "--exclude=*.log",
    "--exclude=*.map",
    "--exclude=./attached_assets",
    "--exclude=./artifacts/island-tacos/public/island-tacos-installer*",
  ];

  const tar = spawn("tar", ["-czf", "-", ...exclude, "."], { cwd: PROJECT_ROOT });

  tar.stdout.pipe(res);

  tar.stderr.on("data", (data: Buffer) => {
    // log but don't fail — tar emits warnings about changing files that are harmless
    console.warn("[download/project] tar warning:", data.toString().trim());
  });

  tar.on("error", (err: Error) => {
    if (!res.headersSent) {
      res.status(500).send("Failed to create archive: " + err.message);
    }
  });

  req.on("close", () => tar.kill());
});

export default router;
