---
name: WhatsApp WABA mismatch
description: The META_WABA_ID env var points to the Test WABA, not the Island Tacos production WABA. Templates must be created in the correct WABA or sends fail with error 132001.
---

# WhatsApp WABA mismatch

## The rule
`META_WABA_ID=956881270482368` ("Test WhatsApp Business Account") is NOT the same
WABA that owns the Island Tacos phone number (+1 284-544-8088, ID 1088934664312843).
Templates must be created in the WABA that owns the sending phone number, or Meta
returns error 132001 ("Template name does not exist in the translation").

**Why:** Meta looks up templates per-WABA. The phone number ID determines which WABA
is checked. Creating a template in the test account does nothing for the live number.

**How to apply:** When adding any new WhatsApp template:
1. In Meta Business Manager → WhatsApp Manager, switch to the account showing
   "+1 284-544-8088 / Island Tacos" (NOT "Test WhatsApp Business Account").
2. Create the template there.
3. The `META_WABA_ID` env var is only used for template management API calls (listing
   templates). It does NOT affect message sending — the phone number ID does.

## island_tacos_order_receipt template (pending)
Still needs to be created in the correct (Island Tacos) WABA.
Structure confirmed from test account (same structure needed):
- Category: Utility
- Header: TEXT — "Your Order Receipt" (static, no component in API call)
- Body: `Hi {{1}}, here is your receipt for Order #{{2}}.\n\n{{3}}\n\nThank you...`
  - {{1}} = customer name, {{2}} = confirmation code, {{3}} = formatted item list
- Footer: "Island Tacos — Wickhams Cay 1, Road Town" (static)

## Code fix applied (2026-06-09)
`sendOrderReceiptWhatsApp` was updated to send 3 body params (not 2) and no
document header component (the TEXT header is static). The old code sent a
document header + 2 params which caused "Invalid parameter" regardless of WABA.
