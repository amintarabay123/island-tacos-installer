---
name: api-server dev runs a prebuilt bundle
description: Local dev serves dist/index.mjs, not source — rebuild before restart to test changes
---

# The api-server dev workflow runs a prebuilt bundle, not source

`artifacts/api-server` (and `artifacts/cedar-api`) `dev` script is
`node ./dist/index.mjs` — it does NOT watch or compile source. Restarting the
workflow just re-runs the **stale** `dist/index.mjs`.

**To make a source change take effect locally:**
`pnpm --filter @workspace/api-server run build` (esbuild, via build.mjs) **then**
restart the workflow.

**Why:** esbuild `build` does not typecheck, so the build succeeds even with
pre-existing tsc errors (e.g. placetopay-poller.ts / payments.ts). Production
deploy rebuilds from source, so committing source is what ships — the local
`dist/` is only for the dev workflow.

**Symptom of forgetting this:** a newly added route returns the wrong response
(e.g. a new `/orders/xyz` route falls through to `/orders/:id` and returns
`{"error":"Not authenticated"}` from requireStaffAuth instead of the new
handler's response) even though the source and route order are correct.
