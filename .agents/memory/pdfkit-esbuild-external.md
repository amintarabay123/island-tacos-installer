---
name: pdfkit esbuild external + mini PC install
description: pdfkit must be marked external in esbuild or it crashes at runtime looking for AFM font files in dist/. Installing it on the mini PC requires a specific approach.
---

# pdfkit + esbuild: must be external

**Rule:** Add `"pdfkit"` to the `external` array in `artifacts/api-server/build.mjs` (already done). Never bundle pdfkit.

**Why:** pdfkit reads AFM font metrics files from the filesystem using a path relative to its own `__dirname`. When esbuild bundles the code, `__dirname` in the bundle resolves to `dist/`, so pdfkit looks for `dist/data/Helvetica.afm` — which doesn't exist. Crash on first `new PDFDocument()`.

**How to apply:** If any new PDF library is added that reads its own data files at runtime (afm files, font files, etc.), mark it external in `build.mjs` for the same reason.

# Mini PC install: pdfkit must go in dist/node_modules

Because the mini PC only receives `artifacts/api-server/dist/index.mjs` (single file), any external package must be installed into `dist/node_modules/` for Node's module resolution to find it relative to the bundle.

**UPDATE.ps1 installs pdfkit automatically** (Step 3b): creates a throwaway `package.json` in `dist/`, runs `npm install pdfkit --prefix dist/ --no-save`, then removes it. The temp package.json is required because running npm inside the workspace package dir (`artifacts/api-server/`) triggers EUNSUPPORTEDPROTOCOL — npm cannot resolve pnpm `catalog:`/`workspace:` specifiers.

# Installer archive generation: do NOT run on mini PC

`initInstallerCache()` in `downloads.ts` runs on every server startup. On the cloud it builds a tar.gz and uploads to GCS. On the mini PC:
- GCS is unreachable (no service-account creds) → `gcsReachable` stays false
- `generateAndUpload()` is skipped entirely
- **Without this guard**: tar spawns without `windowsHide:true` → flashes a console window on every server restart. If the server was crash-looping, this caused a popup storm (one window every ~4 seconds).

**Fix already in place:** `gcsReachable` flag in `initInstallerCache` + `windowsHide:true` + `tar.stderr.resume()` on the spawn call.
