---
name: Payment events sync gap
description: Why payment_events must be pulled cloud→mini PC and how the sync maps them
---

# Payment events only exist in the cloud

Placetopay payment events (`payment_events` table) are written **only in the
cloud** — Placetopay's webhook / status poller can only reach a public URL, and
the mini PC sits on a private LAN. So the cloud DB is the sole origin of these
rows.

**The gap (fixed):** the mini PC's online-orders sync pulled orders +
paymentStatus but NEVER payment_events. The local (mini PC) admin reads only its
own DB, so its payment-events log was always empty even though the cloud admin
showed events correctly. This is NOT an "events not written" bug — cloud
production writes them fine.

## The fix pattern

- Cloud endpoint `GET /api/orders/payment-events-sync?since=...` (Bearer
  SYNC_SECRET, mirrors `/api/orders/online-sync`). LEFT JOINs orders so it can
  return the **confirmationCode as orderRef** (falls back to stored order_ref).
- Mini PC pull step in `online-orders-sync.ts` (`syncPaymentEvents`, own cursor,
  runs after the order sync in the loop). Only active when SYNC_TARGET_URL set.

## Rules that matter

- **Never copy the numeric `order_id` cloud→local** — serial ids differ between
  the two databases. Re-resolve the local order id from `confirmationCode`.
  If the order isn't local yet, still insert the event with `orderId = null`
  (order_ref alone drives the admin log).
- **payment_events has no natural unique key** → dedup on
  `(orderRef, event, rawStatus, createdAt-ms)`, preserving the cloud's
  createdAt so the tuple is stable across repeated pulls (60s cursor overlap).
- Mirrored into cedar-api for code parity, but Cedar is cloud-only (no mini PC,
  no SYNC_TARGET_URL) so the pull is a dead path there — Cedar admin already
  reads its own cloud DB directly.
