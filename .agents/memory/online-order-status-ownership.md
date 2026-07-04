---
name: Online order status ownership (cloud vs mini PC)
description: Which side owns order.status vs paymentStatus in the cloud↔mini-PC sync, and why the sync must never pull status down.
---

# Online order status ownership

For online orders in the two-DB topology (cloud api-server ↔ mini-PC local api-server):

- **`paymentStatus` is owned by the CLOUD.** PlaceToPay/ATH confirmation happens on the cloud poller. The mini PC's 5s sync loop (`startOnlineOrdersSync` in `online-orders-sync.ts`) pulls `paymentStatus` cloud→local in the "order already exists locally" branch. This is the documented reason that branch exists.

- **`order.status` is owned by the MINI PC.** Staff accept/prepare/ready/complete all happen locally (POS `acceptOnline` PATCHes `status:"confirmed"`), then flow UP to the cloud via `pushStatusToCloud` — which is **fire-and-forget with no retry**.

**Rule:** the sync loop must sync ONLY `paymentStatus` cloud→local, never `status`.

**Why:** pulling cloud `status` back down reverts a locally-accepted order to `pending` whenever the fire-and-forget write-back lost the 5s race or failed. The KDS hides `pending` orders (`kitchen.tsx` filter), so the order silently vanished from the board. This was the intermittent "accepted online order not reaching the KDS" bug — payment-method-agnostic (hit cash "pay at counter" orders too, not just PlaceToPay).

**How to apply:** applies to BOTH `artifacts/api-server` and `artifacts/cedar-api` (identical sync code — keep them in lockstep). If cloud-initiated cancellations ever become a real flow, handle them explicitly (e.g. only allow cloud→local for `cancelled`), never by re-enabling a blanket status pull.

**Residual (not a KDS bug):** if the write-back fails, the cloud order stays stale, so the customer's cloud tracking page shows an out-of-date status until the next local status change triggers another write-back. Fixing that needs retry/queue on `pushStatusToCloud`, which is a separate hardening from the KDS drop.
