---
name: POS order fetches must be bounded
description: Any client polling or drawer that lists orders must use activeOnly/limit — unbounded GET /api/orders freezes the low-power POS device as history grows.
---

**Rule:** No client code may call `GET /api/orders` without either `activeOnly=true` or a `limit`. Open-ticket views use `activeOnly=true` (server excludes cancelled and completed+paid, keeps completed+unpaid chargeable); history views use `limit`.

**Why:** The POS runs on a low-power Sunmi Android device. The held-tickets and receipts drawers fetched the entire order history (months of data, re-fetched every 8s while the tickets drawer was open), locking the main thread — daily freezes requiring app restarts (July 2026).

**How to apply:** When adding any new order list/poll (POS, KDS, admin, reports), pick `activeOnly` or an explicit `limit` and prefer pushing filters server-side. Applies to both tenants (island-tacos/api-server and cedar-cafe/cedar-api) — keep the param behavior identical in both order routes.
