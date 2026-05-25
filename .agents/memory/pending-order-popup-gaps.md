---
name: Pending-order popup backlog gaps
description: Known UX/product gaps in the POS new-order popup; bundle when next touching it.
---

The POS "new order" popup (full-screen modal triggered when source in ('online','phone') and status='pending') has three structural gaps that bite when the backlog grows past a handful:

1. **No auto-expiry of stale pending orders.** Orders sit pending forever if staff never accepts/rejects (power cut, kitchen overload, app left closed). The popup then re-floods on next POS open. Need a server-side job that auto-cancels pending orders after N minutes (configurable per store, default ~30) and notifies the customer.

2. **No bulk triage UI.** Dismiss All (added 2026-05-25) hides the popup but doesn't resolve the orders — real customers would be ghosted. Need a proper backlog screen with filter-by-age, batched accept/reject, and a clear "this customer is still waiting for a response" signal.

3. **No batched accept/reject** for the common case of multiple orders arriving while staff was busy.

**Why:** in a real shop, the failure modes are not "one order at a time" — they're "we just unlocked the POS and there are 20 orders stacked up." The current per-order popup loop forces 20 individual decisions and gives no way to triage by age or batch-respond.

**How to apply:** next time anyone touches the popup, the badge counter, or the pending-order poll, address these together rather than patching them piecemeal. Also relevant to the SaaS rollout — other restaurants will hit this immediately, not eventually.
