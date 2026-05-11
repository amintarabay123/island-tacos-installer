# Island Tacos — Online Ordering & POS System

## User preferences

- **Root fixes only — no patches or temporary workarounds.** When a bug or issue is found, diagnose the underlying cause and fix it there. Do not paper over symptoms. If a quick patch is unavoidable for safety (e.g. stop the bleed during business hours), say so explicitly and schedule the real fix.
- **Always re-verify after a change.** After any fix or new feature, re-check that:
  1. The original issue is actually resolved (not just the symptom).
  2. Nothing else broke as a side effect (run typecheck; trace call sites of changed functions; check related features that share the same code path).
  3. Both deployment targets are consistent — cloud (Replit) AND the mini PC at the shop. A fix that only ships to one is incomplete.
- **Goal: production-grade, stable system.** This product is intended to be sold to other restaurants. Code quality, error handling, observability, and consistency matter as much as features. Prefer robust solutions over clever ones.
- **Don't deploy during business hours** unless the change is text/config-only and explicitly approved.
- **Branch convention for non-trivial changes.** Direct commits to `main` are fine for one-line fixes, config tweaks, and docs. Anything bigger (new feature, refactor touching 3+ files, schema change, dependency bump) goes on a `cursor/<topic>` or `replit/<topic>` branch and lands via PR. CI (`.github/workflows/ci.yml`) runs typecheck + audit + tests on every push and PR — a red CI must be green before merge. This prevents the "two AI agents silently overwrote each other on main" failure mode.

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
- **Twilio is kept as a fallback** (used only when `SMS_GATEWAY_*` is unset or the gateway request fails). Once the phone is configured, Twilio is automatically bypassed. `VAPI_*` env vars were fully removed (May 2026).

## Loyverse Integration (Legacy/Minimal)

- `LOYVERSE_API_TOKEN` secret is present
- Menu sync (`POST /api/loyverse/sync`) still works for importing existing menu data
- Orders are NO LONGER auto-pushed to Loyverse — the system is self-contained
- Schema columns retained: `loyverse_id`, `loyverse_item_id`, `loyverse_variant_id`, `loyverse_modifier_ids`

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
