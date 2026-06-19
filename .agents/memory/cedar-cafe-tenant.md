---
name: Cedar Cafe tenant setup
description: How Cedar Cafe is wired as the second tenant in this monorepo — routing, DB, store profile.
---

## Key facts

**Artifacts**: `artifacts/cedar-cafe/` (frontend, port 18185, path `/cedar`) and `artifacts/cedar-api/` (API, port 8181, path `/cedar-api`).

**API routing**: The Vite client calls `/api/…` by default. `setBaseUrl("/cedar-api")` in `artifacts/cedar-cafe/src/main.tsx` prepends `/cedar-api`, making calls go to `/cedar-api/api/store-settings` etc. The cedar-api server mounts the router at `/api`, `/cedar-api`, and `/cedar-api/api` — all three mounts live in `artifacts/cedar-api/src/app.ts`.

**STORE_PROFILE_ID**: `store-settings.ts` supports a `STORE_PROFILE_ID` env var. When set, it selects that specific row from `store_profile` instead of defaulting to `ORDER BY id LIMIT 1`. Cedar-api sets `STORE_PROFILE_ID=2` in its `artifact.toml [services.env]`.

**DB layout (dev)**: Cedar-api uses `postgresql://postgres:password@helium/cedarcafe` (dedicated local DB, set in artifact.toml [services.env]). The shared Replit Postgres has Island Tacos at id=1 and Cedar Cafe at id=2. Helium/cedarcafe has Cedar Cafe at BOTH id=1 (old boot before STORE_PROFILE_ID was introduced) and id=2 (current active row per STORE_PROFILE_ID=2).

**Why:** Because the dev environment uses a dedicated DB per tenant (`helium/cedarcafe`), but the cloud deployment shares a single Replit Postgres. STORE_PROFILE_ID allows the same code to work in both topologies.

**How to apply:** When seeding Cedar Cafe data: use `PGPASSWORD=password psql -h helium -U postgres -d cedarcafe` for the dev DB, and `executeSql()` for the shared Replit Postgres. Both need Cedar Cafe data at their respective STORE_PROFILE_ID-targeted row.

**Dev workflow rebuild requirement**: cedar-api's dev script runs `node ./dist/index.mjs` (pre-built). Changes to `src/` require `pnpm --filter @workspace/cedar-api run build` before restart_workflow takes effect.

**Self-seed env vars**: `STORE_NAME`, `STORE_PHONE`, `STORE_EMAIL`, `STORE_ADDRESS`, `STORE_TIMEZONE` in `[services.env]` let the self-heal logic create a valid row if the DB is empty. Without them, self-seed creates "My Restaurant" with empty fields.
