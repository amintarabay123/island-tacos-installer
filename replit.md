# Island Tacos — Online Ordering & POS System

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
- `/admin/pos` — Full POS (dark theme, category tabs, item grid, cart, payment modal: cash+change calc, card, ATH Móvil, receipt print, discount, hold/ticket drawer, live orders queue)
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

## DB Schema Notes

- Never change primary key ID column types (serial ↔ varchar) — use direct SQL via executeSql for schema changes
- After adding new columns to `lib/db/src/schema/`, run `cd lib/db && npx tsc -p tsconfig.json` to rebuild declarations before typechecking api-server
- `drizzle-kit push` may block on interactive prompts for unique constraint renames — use direct SQL ALTER TABLE instead
