---
name: WhatsApp reminder delivery tracking
description: How reminder delivery status flows cloud → mini PC and the rules that keep it correct
---

Pickup-reminder delivery state lives in `wa_reminder_msg_id` + `wa_reminder_status` on orders ("sent" | "delivered" | "failed" | "failed_not_whatsapp").

**Rules:**
- These fields are **cloud-owned** (reminder job + Meta status webhook only run in the cloud). They mirror cloud→local through the online-sync pull, exactly like `paymentStatus`. Never write them locally.
- Meta status webhooks must apply **monotonic transitions only** (update WHERE status='sent'), or stale/retried events flip a recorded failure back to delivered (and vice versa).
- Meta can report a failure **before** the reminder job stamps the wamid on the order, and Meta never retries after our 200 ack — the webhook retries the match after 2s/5s to close that race.
- Meta error **131026** = recipient number is not a WhatsApp user → status "failed_not_whatsapp", shown as a red "No WhatsApp on this number" badge on KDS ready cards.

**Why:** delivery failures are the whole point of the feature; losing or misordering them silently defeats it (code-review finding, Aug 2026).
