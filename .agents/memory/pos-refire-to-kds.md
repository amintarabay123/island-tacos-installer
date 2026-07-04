---
name: POS "Re-fire to KDS" button (live/held orders panel)
description: The manual re-fire-to-KDS action on POS order cards — what it does, the KDS visibility rule it relies on, and how it must be propagated to both tenants and both deploy targets.
---

# POS "Re-fire to KDS" on the live/held orders panel

Staff can manually push an order back to the Kitchen Display System from the POS **Orders** drawer (the live-queue + held-tickets panel, i.e. `TicketsDrawer` in `pos.tsx`). Before, re-fire only existed in the Receipts detail view; this puts it on every order card where staff actually work, as a recovery tool for the rare case an order disappears from the kitchen board.

**What the action does:** `PATCH /api/orders/:id` with `{ kdsCleared: false }`, and — ONLY when the order is still `pending` — also `status: "confirmed"`. An order's existing cooking status (`confirmed`/`preparing`/`ready`) is never overwritten. Per-order UI feedback: Sending… / ✓ Sent to KDS / Re-fire failed.

**Why the conditional status bump:** the KDS only shows orders that are NOT `kdsCleared` AND NOT `pending` (and <24h old, not cancelled). So clearing `kdsCleared` alone is enough for an already-accepted order, but a still-`pending` ticket also needs promoting to `confirmed` or it stays hidden. Never blanket-set status to `ready` here (that would falsely mark a still-cooking order done — the Receipts-view re-fire uses `ready` only because those are already-completed orders).

**No API/contract change needed:** it reuses the existing orders PATCH endpoint that already accepts `kdsCleared` (the Receipts re-fire uses the same field).

**Propagation rule (applies to any POS UI change like this):**
- Implement in BOTH tenants: `artifacts/island-tacos/src/pages/pos.tsx` AND `artifacts/cedar-cafe/src/pages/pos.tsx` (the two POS files are kept feature-consistent). Verify each with `pnpm --filter @workspace/<island-tacos|cedar-cafe> run typecheck`.
- Reaching each running register is a SEPARATE step from committing code:
  - **Island Tacos:** publish this Replit, then run **UPDATE.bat** on the in-shop mini PC (that's the register that matters — cloud is only the operator console).
  - **Cedar Cafe:** cloud-only, no mini PC. The Cedar Replit is a separate project that pulls branch `replit/cedar-cafe-tenant`; it goes live when that project is published. Hand this note to the Cedar Replit agent so it confirms `artifacts/cedar-cafe/src/pages/pos.tsx` has the re-fire button and publishes.

**For the Cedar agent (recall summary):** "Add / confirm a 'Re-fire to KDS' button on each order card in the POS Orders drawer (TicketsDrawer) in `artifacts/cedar-cafe/src/pages/pos.tsx`. It PATCHes the order with `kdsCleared:false` (plus `status:'confirmed'` only if the order is still `pending`), never clobbering a cooking status, with per-order sending/sent/error feedback. Typecheck the cedar-cafe frontend, then publish the Cedar project."
