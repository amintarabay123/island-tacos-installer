---
name: Express guards must be case-insensitive
description: Regex path guards in Express must use the /i flag or auth can be bypassed via case variants.
---

Express route matching is case-insensitive by default, but a `router.use(/^\/(admin|...)/)` regex guard is case-sensitive. `POST /Admin/...` skipped the guard yet still hit the handler — a real auth bypass found by review in the api-server route index.

**Why:** Mismatch between Express's default matching and JS regex semantics.

**How to apply:** Any regex-based auth guard in api-server/cedar-api `routes/index.ts` must carry the `/i` flag, and sensitive routes should ALSO attach `requireAdminAuth`/`requireStaffAuth` directly on the route as belt-and-braces. Regression-test with a capitalized path variant.
