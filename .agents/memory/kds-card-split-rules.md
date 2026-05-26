---
name: KDS add-on card split rules
description: When the kitchen display splits an order into a separate ADD-ON card vs. the main "full" card, and why status must NOT gate the split.
---

# Rule

Split a KDS order into a separate ADD-ON card whenever its KDS items contain BOTH `alreadyMade=true` lines and `alreadyMade=false` lines. Do not gate the split on `order.status`.

**Why:** The primary trigger for a mixed order is the POS resume-and-add flow, which uses a cancel + recreate path. The recreated order is brand-new, so its status is `confirmed` — not `preparing` or `ready`. Gating the split on `status !== "confirmed"` silently disables it for the exact case it was built for, and cooks end up seeing one mixed card and re-making the original items (the bug we set out to fix).

**How to apply:** In the KDS card composer, the only condition for emitting an ADD-ON card in the New column + a "full" card (with the new items hidden) in the target column is the mix itself. Once all items flip `alreadyMade=true`, the KDS filter naturally removes the order from the board; for walk-in POS resumes that's correct because there is no customer notification tied to status advancement.

# Known follow-up gap

`fetchOrders()` in `kitchen.tsx` is called from both the poll timer and from manual actions (`markItemsMade`, `advance`, `clearFromKds`). Only the timer path guards against overlap. Out-of-order responses can skew the `prevIdsRef` / `prevNewItemIdsRef` diffing used for the new-order and add-on chime, causing missed or duplicate chimes. Add a request version / AbortController to the fetch pipeline if chime reliability becomes a complaint.
