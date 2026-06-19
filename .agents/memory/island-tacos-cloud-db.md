---
name: Island Tacos cloud DB is always empty
description: The Replit cloud Postgres for Island Tacos has no menu data — that lives on the mini PC only.
---

## Rule

The cloud Replit PostgreSQL database for Island Tacos always has 0 rows in `menu_items` and `menu_categories`. This is normal and expected — not a bug.

**Why:** Real menu data was imported via Loyverse sync and lives only on the mini PC's local Postgres. The cloud database is a schema-only shell used for running the API server in the cloud (order tracking, admin sync, etc.). No sync runs menu data to the cloud.

**How to apply:** If the user asks "why is the menu empty in the preview?" — the answer is always this. Do not investigate further or suggest fixes. The preview will always show an empty menu because the cloud DB has no items.
