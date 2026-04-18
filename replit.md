# Island Tacos Online Ordering

## Overview

Full-stack online ordering system for Island Tacos restaurant (Puerto Rico). Replaces GloriaFood with a custom-branded ordering experience, BPPR/ATH Móvil payment support, and Loyverse POS integration.

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

## Architecture

- `artifacts/island-tacos/` — Customer-facing ordering website and admin panel
- `artifacts/api-server/` — Express API server (menu, orders, payments, loyverse, admin stats)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/db/src/schema/` — Database schema (menu_categories, menu_items, orders, order_items)

## App Pages

- `/` — Customer menu & ordering (browse by category, cart, add to cart)
- `/checkout` — Checkout (customer info, order type pickup/delivery, payment method)
- `/track` — Order tracking by confirmation code
- `/admin` — Admin dashboard (live orders, stats, status management, Loyverse sync button)
- `/admin/menu` — Menu item management (add, edit, toggle availability)

## Payment Integration

Payment gateway is a placeholder pending merchant credentials:
- **Card payments**: BPPR Elavon/Converge gateway — needs `ELAVON_MERCHANT_ID`, `ELAVON_USER_ID`, `ELAVON_PIN`
- **ATH Móvil Business**: Needs `ATHMOVIL_PUBLIC_TOKEN`, `ATHMOVIL_PRIVATE_TOKEN`
- **Apple Pay**: Will work through card gateway (supported by browsers natively)
- Until configured, customers can choose "Pay at Pickup" (cash/card at restaurant)

## Loyverse POS Integration (LIVE)

- `LOYVERSE_API_TOKEN` secret is configured
- Store ID: `fa2b85a6-711d-11ea-8d93-0603130a05b8`
- Employee ID: `324dd4ee-71a9-11ea-8d93-0603130a05b8`
- Menu sync: `POST /api/loyverse/sync` — pulls all categories, items, modifiers from Loyverse
- Order push: `POST /api/loyverse/push/:orderId` — pushes confirmed order as a receipt to Loyverse
- Auto-push: Orders auto-push to Loyverse when status changes to "confirmed"
- Admin "Sync from Loyverse" button triggers the sync on demand
- 16 categories, 50+ items with modifiers synced from Loyverse
- Schema columns added: `loyverse_id`, `loyverse_item_id`, `loyverse_variant_id`, `loyverse_modifier_ids` (array)
- Loyverse API uses `/receipts` for completed sales only (no open ticket / reject support)

## Tax Rate

Puerto Rico IVU: 11.5%

## Delivery

- Flat $3.00 delivery fee
- Free delivery for orders over $25

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
