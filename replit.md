# Island Tacos Online Ordering

## Overview

Full-stack online ordering system for Island Tacos restaurant (Puerto Rico). Replaces GloriaFood with a custom-branded ordering experience, BPPR/ATH Móvil payment support, and Loyverse POS integration support.

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
- `artifacts/api-server/` — Express API server (menu, orders, payments, admin stats)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/db/src/schema/` — Database schema (menu_categories, menu_items, orders, order_items)

## App Pages

- `/` — Customer menu & ordering (browse by category, cart, add to cart)
- `/checkout` — Checkout (customer info, order type pickup/delivery, payment method)
- `/track` — Order tracking by confirmation code
- `/admin` — Admin dashboard (live orders, stats, status management)
- `/admin/menu` — Menu item management (add, edit, toggle availability)

## Payment Integration

Payment gateway is a placeholder pending merchant credentials:
- **Card payments**: BPPR Elavon/Converge gateway — needs `ELAVON_MERCHANT_ID`, `ELAVON_USER_ID`, `ELAVON_PIN`
- **ATH Móvil Business**: Needs `ATHMOVIL_PUBLIC_TOKEN`, `ATHMOVIL_PRIVATE_TOKEN`
- **Apple Pay**: Will work through card gateway (supported by browsers natively)
- Until configured, customers can choose "Pay at Pickup" (cash/card at restaurant)

## Loyverse POS Integration

Loyverse API integration is planned — requires `LOYVERSE_API_TOKEN` (free from Loyverse back office → Settings → API Access). Orders will be pushed to Loyverse automatically when created.

## Tax Rate

Puerto Rico IVU: 11.5%

## Delivery

- Flat $3.00 delivery fee
- Free delivery for orders over $25

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/island-tacos run dev` — run frontend locally
