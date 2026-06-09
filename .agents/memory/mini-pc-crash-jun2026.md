---
name: Mini PC crash after UPDATE — June 2026 (RESOLVED)
description: Crash-loop after UPDATE.bat caused by missing pdfkit + installer tar popup storm. Fully fixed.
---

# RESOLVED 2026-06-09

## Root causes (two separate issues, same UPDATE)

### 1. `Cannot find module 'pdfkit'`
pdfkit is external in esbuild. The mini PC only gets `dist/index.mjs`, so pdfkit
must be in `dist/node_modules/pdfkit`. UPDATE.ps1 now installs it automatically
(Step 3b) using a throwaway `package.json` in `dist/` to avoid EUNSUPPORTEDPROTOCOL
from npm seeing pnpm workspace specifiers.

### 2. Console popup storm (every 2-4 seconds)
`initInstallerCache()` runs on every server startup and calls `generateAndUpload()`,
which spawns `tar` to build a GCS archive. On the mini PC:
- `tar` was spawned without `windowsHide: true` → flashing console window on every restart
- `tar.stderr` was never drained → pipe buffering caused unclean process exit → crash
- Server crashed → PM2 restarted → tar spawned again → infinite loop

**Fix:** `gcsReachable` flag in `initInstallerCache` skips `generateAndUpload` entirely
when GCS throws (i.e. on the mini PC). Also added `windowsHide: true` and
`tar.stderr.resume()` to the spawn call as defense-in-depth.

## Lesson
The shop mini PC has `DEFAULT_OBJECT_STORAGE_BUCKET_ID` in its `.env` (injected by
`/api/download/env`), so checking that env var is NOT a reliable way to detect
"is this the mini PC". Use GCS reachability (`gcsReachable` flag) instead.
