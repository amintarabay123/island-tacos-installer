---
name: Resumed-ticket PATCH-vs-recreate rule
description: When saving a resumed held ticket, PATCH only if NOTHING about the items changed; otherwise cancel+recreate.
---

`PATCH /api/orders/:id` does NOT accept an `items` array. It only updates order-level fields (notes, payment status, payment method, status, amount tendered). So any structural change to a resumed ticket's lines — adding, removing, or changing quantity — is silently lost if the save path takes the PATCH branch.

**Rule:** the "noNewItems" guard in `placeOrder`/`handleSplitPay` must check all three:
1. `resumedOrderId` is set.
2. `cart.every(c => c.alreadyMade)` (no brand-new lines).
3. `resumedItemsUnchanged()` (no resumed line was removed or had its quantity changed).

All three true → PATCH (keeps order on KDS, avoids re-firing kitchen). Any one false → cancel old order + POST a new one with the full cart.

**Why:** the PATCH-only path exists because cancel+recreate would yank the ticket off KDS (all items `alreadyMade=true` → KDS filter hides it). But that optimization only works when the items genuinely haven't changed. Two bugs in May 2026 came from a too-loose guard: removing a line, or changing a quantity on an already-made line, both took the PATCH path and the change vanished from the saved order.

**How to apply:** if you add new ways to mutate the cart while a ticket is resumed (e.g. a new "swap line" feature, bulk discount per item, etc.), make sure the snapshot comparison covers your new mutation, or invalidate `alreadyMade` on the affected lines so the existing `cart.every(alreadyMade)` check trips. The snapshot is captured in `handleResume` and cleared in `clearCart`.
