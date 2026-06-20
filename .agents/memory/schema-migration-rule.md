---
name: Schema migration rule
description: Every schema change must be applied to the production database immediately — never just update the code.
---

## Rule

When adding or changing a column in `lib/db/src/schema/`, three things must happen together in the same task:
1. Update the Drizzle schema file
2. Update `local-install/schema.sql` with the idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
3. **Apply the migration to the production database immediately** via `psql "$DATABASE_URL" -c "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...;"`

Never leave step 3 for later. A schema/code mismatch in production breaks every query that touches that table — this caused the Island Tacos sync to return 500 and the online menu to fail (Jun 2026).

**Why:** The production database is not automatically migrated on deploy. Drizzle ORM generates queries using the schema definition, so if the code expects a column that doesn't exist in production, every query on that table crashes with a 500.

**How to apply:** After every `lib/db/src/schema/` change, immediately run `psql "$DATABASE_URL" -c "ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>;"` before committing.
