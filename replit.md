# Island Tacos — Online Ordering & POS System

## User preferences

- **Be thorough — no partial execution.** When given an instruction (debrand all pages, remove all hardcoded strings, apply a fix everywhere it appears), do it completely across every file and instance. Do not stop after a few examples and assume the rest is done. If the scope is too large for one pass, say so explicitly and list what remains — never silently do a partial job.
- **Root fixes only — no patches or temporary workarounds.** When a bug or issue is found, diagnose the underlying cause and fix it there. Do not paper over symptoms. If a quick patch is unavoidable for safety (e.g. stop the bleed during business hours), say so explicitly and schedule the real fix.
- **Always re-verify after a change.** After any fix or new feature, re-check that:
  1. The original issue is actually resolved (not just the symptom).
  2. Nothing else broke as a side effect (run typecheck; trace call sites of changed functions; check related features that share the same code path).
  3. Both deployment targets are consistent — cloud (Replit) AND the mini PC at the shop. A fix that only ships to one is incomplete.
- **Goal: production-grade, stable system.** This product is intended to be sold to other restaurants. Code quality, error handling, observability, and consistency matter as much as features. Prefer robust solutions over clever ones.
- **Don't deploy during business hours** unless the change is text/config-only and explicitly approved.
- **Branch convention for non-trivial changes.** Direct commits to `main` are fine for one-line fixes, config tweaks, and docs. Anything bigger (new feature, refactor touching 3+ files, schema change, dependency bump) goes on a `cursor/<topic>` or `replit/<topic>` branch and lands via PR. CI (`.github/workflows/ci.yml`) runs typecheck + audit + tests + the **anon-auth matrix** on every push and PR — a red CI must be green before merge. This prevents the "two AI agents silently overwrote each other on main" failure mode.

## CI: anon-auth matrix

A bash script (`scripts/src/anon-auth-matrix.sh`, runnable as `pnpm --filter @workspace/scripts run check:auth`) hits every interesting API route as an anonymous client and asserts the response code matches the expected gate posture (public → 200, staff/admin → 401|403, M2M sync → 401 without secret / 200 with). The CI job `anon-auth-matrix` in `.github/workflows/ci.yml` boots a Postgres service, applies `local-install/schema.sql`, builds and starts api-server, and runs the script. This catches the "router mounted before its guard" failure mode that typecheck cannot see — the exact bug class that produced the May 2026 dead-guard cleanup. **When you add a new route, add it to the matrix in the same PR.**

## Long-term product vision (SaaS)

This system is being built toward a sellable product for other restaurants. Two deliverables drive every architectural choice:

1. **One-USB installer for the in-shop side.** A single USB stick that, when plugged into a fresh mini PC and run, installs and configures EVERYTHING needed at the restaurant: Node, Postgres, the local API server, the POS/KDS in browser kiosk mode, printer drivers, auto-start on boot, auto-update. No manual fiddling. Owner enters: store name, owner email, license key. Done. Implication for current code: keep the local install bundle (`local-install/`, `UPDATE.bat`, `UPDATE.ps1`, `migrate.mjs`, `schema.sql`) clean, idempotent, and free of Island-Tacos-specific hardcoding (store name, branding, phone numbers, BVI-specific assumptions, etc.).

2. **Central tenant admin website.** A web app where the SaaS owner (and eventually self-serve restaurants) can:
   - Register a new restaurant (creates tenant in central DB)
   - Provision a subdomain (e.g. `taqueriajoe.orderhub.app`) automatically with SSL
   - Generate the restaurant's license key + sync secrets that the USB installer will accept
   - View per-tenant billing, order volume, support status
   - Push remote updates to a tenant's mini PC

Implication for current code: anything that's currently a hardcoded constant ("Island Tacos", "284-544-8088", "Wickhams Cay 1", BVI tax = 0, "@islandtacosbvi.com" emails) should eventually move to a `store_settings` table or per-tenant config. Multi-tenancy doesn't have to be built today, but new code should NOT add more hardcoded brand strings — read from settings instead.

## Overview

Custom full-stack online ordering + in-house POS system for Island Tacos (Wickhams Cay 1, Road Town, BVI — Mexican food). Designed as a complete replacement for Loyverse, covering online ordering, walk-in POS, Kitchen Display System (KDS), admin dashboard, and receipt printing. Pickup only.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **PWA**: service worker (`/sw.js`) + `site.webmanifest`, installable on iOS/Android

## Architecture

- `artifacts/island-tacos/` — Customer-facing ordering website, admin panel, POS, KDS
- `artifacts/api-server/` — Express API server (menu, orders, payments, admin stats)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/db/src/schema/` — Database schema (menu_categories, menu_items, orders, order_items)

## App Pages

- `/` — Customer menu & ordering (browse by category, cart, checkout)
- `/checkout` — Checkout (customer info, pickup only, payment method)
- `/track` — Order tracking by confirmation code
- `/admin` — Admin dashboard (live orders, stats, status management)
- `/admin/menu` — Menu item management (add, edit, toggle availability)
- `/admin/pos` — Full POS (dark theme, category tabs, item grid, cart, payment modal: cash+change calc, card, ATH Móvil, receipt print, discount, hold/ticket drawer, live orders queue, shift management, cash pay-in/out, refunds)
- `/admin/reports` — Admin sales reports (date range, method breakdown, top items, PDF export, printer settings)
- `/kitchen` — Kitchen Display System (real-time order queue for kitchen staff)
- `/staff-login` — PIN-based staff authentication gate

## Orders Table — Key Columns

- `source`: `'online' | 'pos'` — how the order was created
- `discount_amount`: numeric discount applied at POS
- `payment_status`: `'pending' | 'paid' | 'refunded'`
- `email`, `phone`: nullable (POS walk-ins don't require them)

## Payment Methods

- **Cash** — numpad with change calculator (POS)
- **Card** — mark as card-paid (POS)
- **ATH Móvil Business** — `ATHMOVIL_PUBLIC_TOKEN`, `ATHMOVIL_PRIVATE_TOKEN` secrets configured
- **Online (future)** — "Pay at Pickup" for online orders currently

## SMS Notifications

- Sent via `artifacts/api-server/src/lib/sms-gateway.ts`, which POSTs to an Android phone running the **SMS Gateway for Android** app (https://sms-gate.app).
- Phone holds the BVI business SIM (284-544-8088) on an unlimited-SMS plan → effectively $0/message.
- Required env vars: `SMS_GATEWAY_URL` (e.g. `http://192.168.1.42:8080`), `SMS_GATEWAY_USERNAME`, `SMS_GATEWAY_PASSWORD`. If unset, `sendSms()` is a no-op.
- Both ready and cancellation SMS are restricted to BVI mobiles (`isBVIMobile` check) so the business SIM never gets billed for international SMS. International customers get email + WhatsApp.
- Bodies are kept ≤ 160 chars (1 SMS segment) — cancellation reason is intentionally NOT included; staff follow up by phone.
- **Twilio payment method removed (May 2026) — gateway is the sole intended SMS backend.** The Twilio account still exists but has no payment method, so any attempt to send via Twilio will fail with a billing error. The fallback code path in `sms-gateway.ts` is harmless (it'll just log an error and move on), but deleting the `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` secrets from Replit would skip the wasted HTTP round-trip entirely. `VAPI_*` env vars were fully removed (May 2026).

### SMS Gateway operational notes (learned the hard way 2026-05-11)

- **Cloud Replit must have `SMS_DISABLED=true` set.** Cloud is only used by the operator to clean up duplicate orders that drifted in via sync — those cancellations should NOT fire customer SMS (the customer already got the real notification from the mini PC). The mini PC leaves `SMS_DISABLED` unset so real notifications go out via the local gateway. Hard kill switch is in `sms-gateway.ts` — first thing `sendSms()` checks.
- **Cloud Replit must NOT have `SMS_GATEWAY_*` set.** The phone is on the shop LAN (192.168.x.x) and unreachable from cloud. If set, every cloud-side SMS attempt (before hitting the kill switch) would wait 8s for a TCP timeout before giving up. Cloud SMS is fully suppressed by `SMS_DISABLED`. Mini PC → gateway only (Twilio is cancelled).
- **`SMS_GATEWAY_*` lives in the mini PC's `C:\IslandTacos\.env`**, not in the cloud env or anywhere version-controlled.
- **PM2 does NOT reload `.env` on `pm2 restart <name>`.** It reuses the env captured at first start. To pick up changed env vars on the mini PC, run: `pm2 restart local-install/ecosystem.config.cjs --update-env` (re-reads the config file, which re-runs `loadEnv`). A plain `pm2 restart island-tacos` will silently keep using the stale env — symptom: gateway code path is never hit even though the vars are in `.env`.
- **The Android app needs SMS + Phone permissions** or sends silently fail with `getCarrierConfig` errors. Check Settings → Apps → SMS Gateway → Permissions before declaring it broken. Also set Battery → **Unrestricted** so Android doesn't freeze the app overnight.
- **Default app username is `sms`** (not anything custom). Password starts as "Not set" — must be set manually in the app's Settings → Credentials → Password before the gateway will accept any requests.
- **Test must originate from the local POS at the mini PC**, not from cloud admin. Cloud admin → cloud's Twilio. Local POS → local's gateway.
- **Sanity-check log lines** in `pm2 logs island-tacos`:
  - ✅ `[sms] sent via gateway` — working as intended.
  - ⚠️ `[sms] sent via Twilio` (with no preceding gateway error) — env vars not loaded; PM2 needs `--update-env`.
  - ❌ `[sms] gateway send failed` / `gateway send error` — auth, URL, or network problem.

## Loyverse Integration (Legacy/Minimal)

- `LOYVERSE_API_TOKEN` secret is present
- Menu sync (`POST /api/loyverse/sync`) still works for importing existing menu data
- Orders are NO LONGER auto-pushed to Loyverse — the system is self-contained
- Schema columns retained: `loyverse_id`, `loyverse_item_id`, `loyverse_variant_id`, `loyverse_modifier_ids`

## Frontend tarball pipeline (UPDATE.bat path)

The mini PC's `UPDATE.bat` fetches the latest server bundle and frontend
tarball from `https://orders.islandtacosbvi.com/api/download/{server,frontend}`.
The server bundle is served directly from the cloud api-server's filesystem.
The frontend tarball is served from a GCS object (`installer/island-tacos-frontend.tar.gz`)
because it's too large for the Replit reverse proxy.

**Who writes the GCS frontend tarball:** the island-tacos build's `postbuild`
step (`artifacts/island-tacos/scripts/upload-tarball.mjs`). It tars
`dist/public/` and uploads to GCS at the end of every `pnpm --filter
@workspace/island-tacos run build`. This runs in the frontend artifact's
container during deploy, where `dist/public/` actually exists.

**Who does NOT write it:** the api-server. Earlier code attempted to
regenerate the tarball lazily on api-server startup, but in the current
multi-artifact deployment the api-server's container does not contain
`artifacts/island-tacos/dist/public/`, so any tar attempt silently failed and
the GCS object stayed stale (this caused a week-long bug where frontend fixes
never reached the mini PC — fixed 2026-05-15). The api-server now only signs
the existing GCS object on startup; it never regenerates.

**Local dev / CI:** the postbuild script no-ops cleanly unless
`UPLOAD_FRONTEND_TARBALL=1` is set. That env var is set ONLY in the
island-tacos artifact's `[services.production.build.env]` block, which fires
during deploy. Local `pnpm build` runs and CI builds therefore cannot
overwrite the production GCS object even when the bucket env happens to be
present (e.g. inside this Replit workspace).

**If a deploy ships frontend changes that don't appear on the mini PC:**
check the deploy's island-tacos build logs for the `[postbuild:frontend-tarball]`
lines. A non-zero exit there fails the build loudly. The previous failure
mode (silent stale tarball) is no longer possible.

## Tax Rate

No tax (BVI). Tax not applied at checkout.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `cd lib/db && npx tsc -p tsconfig.json` — rebuild db declaration files after schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/island-tacos run dev` — run frontend locally

## Codegen Notes

- Orval generates both Zod schemas (`lib/api-zod/src/generated/api.ts`) and TypeScript interfaces (`lib/api-zod/src/generated/types/`) from the OpenAPI spec
- The codegen script in `lib/api-spec/package.json` overrides `lib/api-zod/src/index.ts` after orval runs to export only from `./generated/api` — this prevents TS2308 duplicate export errors from conflicting Zod schemas and TypeScript interfaces with the same names

## Additional DB Tables

- `shifts` — Cash register shifts (opening float, closing float, timestamps, notes)
- `cash_transactions` — Pay-in/pay-out entries linked to shifts
- `refunds` — Refund records linked to orders (amount, method, reason)

## Settings: two tables, on purpose

Two settings tables coexist by design — do NOT collapse them:

- **`store_settings` (K/V, load-bearing).** Generic `key TEXT PK, value TEXT` store. Holds operational config edited from the existing admin UI: `open_time`, `close_time`, `open_days`, `cutoff_minutes`, `payment_methods`, `online_payment_methods`, `display_state`, etc. Edited via `GET/PATCH /api/settings`. Frontend admin pages depend on this shape — don't migrate keys out without updating every consumer.
- **`store_profile` (typed, single row).** Strongly-typed identity columns: `store_name`, `phone`, `email`, `address`, `tax_rate`, `timezone`, `currency`. One row today, one row per tenant once multi-tenancy lands. Edited via `GET /api/store-settings` (public) and `PATCH /api/store-settings` (admin). This is where new identity/jurisdiction fields go — never add another hardcoded brand string in code, add a column here instead.

Server-side helper `artifacts/api-server/src/lib/store-settings.ts` has a 60s in-memory cache; `PATCH /api/store-settings` calls `refreshStoreSettings()` to invalidate. Direct SQL UPDATEs to `store_profile` will appear stale for up to 60s.

Migration: `local-install/schema.sql` lines 165–202 define `store_profile` + an idempotent seed. Already applied to the cloud DB on 2026-05-11. The mini PC will pick it up on the next `UPDATE.bat` run (idempotent — safe to re-run).

## Receipt Printing

- `printReceiptLines()` + `buildReceiptLines()` in pos.tsx — unified receipt printer abstraction
- Printer config stored in `localStorage` as `printerConfig`: `{ type: "browser" | "network", ip, port }`
- Network printing sends ESC/POS commands to thermal printer via `/api/print/network` (TCP port 9100)
- Browser printing opens a print-styled popup window as fallback

## API Routes Added

- `GET /api/shifts/current` — get open shift
- `POST /api/shifts` — open new shift
- `PATCH /api/shifts/:id/close` — close shift
- `GET /api/shifts/:id/summary` — Z-report data (sales by method, refunds, pay-ins/outs)
- `GET/POST /api/cash-transactions` — list / record pay-in/out
- `POST /api/orders/:id/refund` — issue refund
- `GET /api/reports/sales` — date-range sales report with method breakdown + top items
- `POST /api/print/network` — ESC/POS network print

## DB Schema Notes

- Never change primary key ID column types (serial ↔ varchar) — use direct SQL via executeSql for schema changes
- After adding new columns to `lib/db/src/schema/`, run `cd lib/db && npx tsc -p tsconfig.json` to rebuild declarations before typechecking api-server
- `drizzle-kit push` may block on interactive prompts for unique constraint renames — use direct SQL ALTER TABLE instead

## Known accepted risks (pnpm audit)

These advisories are surfaced by `pnpm audit --prod` and have been reviewed and
intentionally not patched. Re-evaluate during dependency upgrades.

- **`@tootallnate/once` 2.0.0 — GHSA-vpq2-c234-7xj6 (LOW, "Incorrect Control
  Flow Scoping")**
  - Transitive path: `@google-cloud/storage → (retry-request →) teeny-request → http-proxy-agent → @tootallnate/once`.
  - The vulnerable code only executes when GCS traffic is routed through an
    **outbound HTTP proxy**. We do not configure an HTTP proxy for GCS — both
    the Replit cloud server and the mini PC talk to `*.googleapis.com`
    directly. The code path is unreachable in our deployments.
  - A fix is only available in `@tootallnate/once` 3.x, which is a **major**
    version bump. The versions of `http-proxy-agent` that pull this dep in pin
    `^2.0.0`, so forcing 3.x via pnpm `overrides` breaks `http-proxy-agent` and
    therefore `@google-cloud/storage`. The real fix is for upstream
    `@google-cloud/storage` to drop `teeny-request` in favour of `gaxios`
    (already in progress upstream).
  - Action: leave at current version, recheck on each `@google-cloud/storage`
    upgrade. If we ever start routing GCS calls through an HTTP proxy, this
    must be patched first.
