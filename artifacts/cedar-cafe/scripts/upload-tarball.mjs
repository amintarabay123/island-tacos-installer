#!/usr/bin/env node
// Postbuild step: tar `dist/public/` and upload to GCS so the mini PC's
// UPDATE.bat (which fetches /api/download/frontend on the cloud server) gets
// a fresh build every time we deploy.
//
// Why this lives here instead of api-server:
//   The api-server is a SEPARATE deployed artifact from the island-tacos
//   frontend. In multi-artifact deployments each artifact runs in its own
//   container, so the api-server's filesystem does NOT contain the frontend's
//   `dist/public/` — meaning api-server can never regenerate the tarball
//   itself. The build step is the only place the dist files are guaranteed
//   to be present on the same filesystem.
//
// Behavior:
//   - No-op (with a clear log) if DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set.
//     Local dev builds and CI typecheck/build runs do not have GCS access and
//     should not fail.
//   - Bails out (with a clear log, exit 0) if dist/public is missing.
//   - On success, prints final size + GCS object name + duration.
//   - On upload failure, exits non-zero so the deploy build fails loudly
//     instead of silently shipping a stale tarball.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ISLAND_TACOS_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ISLAND_TACOS_ROOT, "dist", "public");
const TMP_TAR  = path.join(os.tmpdir(), "island-tacos-frontend-build.tar.gz");
const GCS_OBJECT = "installer/island-tacos-frontend.tar.gz";

// Explicit opt-in. Set ONLY in deployment build env (artifact.toml). This
// prevents local `pnpm build` runs in a workspace where DEFAULT_OBJECT_STORAGE_BUCKET_ID
// happens to be set (e.g. this Replit workspace) from accidentally
// overwriting the production GCS object that the mini PC depends on.
const enabled = process.env.UPLOAD_FRONTEND_TARBALL === "1";
const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

function log(msg) {
  console.log(`[postbuild:frontend-tarball] ${msg}`);
}

if (!enabled) {
  log("UPLOAD_FRONTEND_TARBALL!=1 — skipping (this is the safe default for local dev / CI; set in artifact.toml's production build env for deploy).");
  process.exit(0);
}

if (!bucketId) {
  // Opt-in was set but bucket env is missing — that's a misconfigured deploy.
  // Fail loudly so we don't silently ship without an upload.
  console.error("[postbuild:frontend-tarball] FAILED: UPLOAD_FRONTEND_TARBALL=1 but DEFAULT_OBJECT_STORAGE_BUCKET_ID is unset.");
  process.exit(1);
}

if (!fs.existsSync(DIST_DIR)) {
  // We were told to upload but the build produced nothing. Fail loudly so the
  // deploy errors instead of leaving the mini PC stuck on a stale tarball.
  console.error(`[postbuild:frontend-tarball] FAILED: dist directory not found at ${DIST_DIR} — vite build did not produce output.`);
  process.exit(1);
}

const startedAt = Date.now();

async function tarDist() {
  log(`tarring ${DIST_DIR} -> ${TMP_TAR}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(TMP_TAR);
    const tar = spawn("tar", [
      "-czf", "-",
      "-C", DIST_DIR,
      // Excludes match the legacy api-server regen for byte-for-byte parity.
      "--exclude=./island-tacos-installer.tar.gz",
      "--exclude=./docs",
      ".",
    ]);
    tar.stdout.pipe(out);
    tar.stderr.on("data", (chunk) => process.stderr.write(chunk));
    out.on("error", (err) => { tar.kill(); reject(err); });
    tar.on("error", reject);
    tar.on("close", (code) => {
      if (code !== 0) reject(new Error(`tar exited with code ${code}`));
      else resolve();
    });
  });
}

async function uploadToGcs() {
  // Lazy import so the script can no-op without the dep being installed.
  const { Storage } = await import("@google-cloud/storage");

  // Replit's workload-identity sidecar — same pattern api-server uses.
  const storage = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: "http://127.0.0.1:1106/token",
      type: "external_account",
      credential_source: {
        url: "http://127.0.0.1:1106/credential",
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });

  const bucket = storage.bucket(bucketId);
  const file = bucket.file(GCS_OBJECT);

  log(`uploading to gs://${bucketId}/${GCS_OBJECT}`);
  await pipeline(
    fs.createReadStream(TMP_TAR),
    file.createWriteStream({
      resumable: false,
      metadata: {
        contentType: "application/gzip",
        contentDisposition: 'attachment; filename="island-tacos-frontend.tar.gz"',
      },
    }),
  );
}

try {
  await tarDist();
  const size = fs.statSync(TMP_TAR).size;
  await uploadToGcs();
  fs.unlinkSync(TMP_TAR);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`OK — uploaded ${size.toLocaleString()} bytes in ${seconds}s`);
} catch (err) {
  console.error("[postbuild:frontend-tarball] FAILED:", err instanceof Error ? err.stack || err.message : err);
  // Best-effort cleanup, but don't mask the real error.
  try { fs.unlinkSync(TMP_TAR); } catch { /* ignore */ }
  process.exit(1);
}
