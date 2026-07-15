---
name: Watchdog must never restart itself
description: Monitor auto-repair on the mini PC must target only the API app, never the whole PM2 ecosystem config.
---

**Rule:** Any auto-repair or manual-repair command that restarts the API process must use `pm2 startOrRestart local-install/ecosystem.config.cjs --only island-tacos --update-env` — never a bare restart of the ecosystem config.

**Why:** The ecosystem config contains BOTH the API app and the monitor watchdog. A bare config restart kills the watchdog mid-repair: its in-memory failure counters reset on every boot, so the 3-consecutive-fail escalation (WhatsApp/SMS alert) never fires, and PM2 eventually marks the monitor "errored" and stops it — silent outage with zero alerts (June 2026 incident: repeating BOOT/FAIL event-log pattern with fresh PIDs is the signature).

**How to apply:** When adding any new repair/restart path (monitor, admin repair routes, scripts), restart only the named app. Keep the watchdog's `max_restarts` high (50) — if PM2 gives up on the watchdog, nobody alerts the owner. `startOrRestart --only <name> --update-env` re-runs the config's loadEnv (picks up .env changes) and works from the "errored" state.

**Related rule (offline resilience):** frontends must never load fonts (or any render-blocking resource) from external CDNs — a Google Fonts link caused a blank white screen on the mini PC when shop internet was down. Fonts are self-hosted woff2 in each app's `src/fonts/` with `@font-face` in CSS (Vite rebases relative urls per base path; don't use %BASE_URL% in index.html — it doesn't get a trailing slash for sub-path apps like /cedar).
