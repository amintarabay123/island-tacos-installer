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

## WABA IDs (Island Tacos account)
- Production WABA: 1725555828883850 (Island Tacos, owned by Amin O. Tarabay)
- Second WABA: 1358802589471928 (Island Tacos, owned by Amin O. Tarabay)
- Test WABA: 956881270482368 ("Test WhatsApp Business Account") — wrong one
- `META_WABA_ID` env var was set to test WABA; the production templates live in 1725555828883850

## island_tacos_order_receipt template
- Lives in WABA 1725555828883850
- Language: **en_US** (English US) — NOT plain "en" like the other templates
- Code must send language code "en_US" for this template or Meta returns 132001
- Other templates (ready, cancelled, reminder) use plain "en"

## Code fix applied (2026-06-09)
`sendOrderReceiptWhatsApp` updated: 3 body params (not 2), no document header
component, language code "en_US" (not "en"). Old code caused "Invalid parameter"
then 132001 after WABA was identified.
