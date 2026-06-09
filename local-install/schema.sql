-- Island Tacos — Database Schema
-- Safe to run on existing databases (uses CREATE TABLE IF NOT EXISTS)
-- Run: psql -U ituser -d islandtacos -f schema.sql
--
-- NOTE: The monitor/watchdog service uses a SEPARATE SQLite database:
--   local-install/monitor.db  (created automatically by local-install/monitor.mjs)
--
-- Tables in monitor.db:
--   monitor_status  — one row per checked service (api-process, postgres, disk, …)
--   monitor_events  — rolling event log: failures, repairs, escalations, AI diagnoses
--
-- monitor.db is NOT managed by this file. Do not add its tables here.
-- It is read by GET /api/system/health in the api-server.

-- ── Menu ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS menu_categories (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  send_to_kds  BOOLEAN NOT NULL DEFAULT true,
  loyverse_id  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id                    SERIAL PRIMARY KEY,
  category_id           INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  price                 NUMERIC(10,2) NOT NULL,
  image_url             TEXT,
  pos_image_url         TEXT,
  available             BOOLEAN NOT NULL DEFAULT true,
  popular               BOOLEAN NOT NULL DEFAULT false,
  spicy                 BOOLEAN NOT NULL DEFAULT false,
  vegetarian            BOOLEAN NOT NULL DEFAULT false,
  open_price            BOOLEAN NOT NULL DEFAULT false,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  loyverse_item_id      TEXT UNIQUE,
  loyverse_variant_id   TEXT,
  loyverse_modifier_ids TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS menu_items_category_id_idx ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS menu_items_available_idx   ON menu_items(available);
CREATE INDEX IF NOT EXISTS menu_items_sort_order_idx  ON menu_items(sort_order);

CREATE TABLE IF NOT EXISTS modifiers (
  id                    SERIAL PRIMARY KEY,
  loyverse_id           TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  options               JSONB NOT NULL DEFAULT '[]',
  required              BOOLEAN NOT NULL DEFAULT false,
  min_selections        INTEGER NOT NULL DEFAULT 0,
  max_selections        INTEGER,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  unavailable_option_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Orders ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                   SERIAL PRIMARY KEY,
  confirmation_code    TEXT NOT NULL UNIQUE,
  customer_name        TEXT NOT NULL,
  customer_email       TEXT NOT NULL DEFAULT '',
  customer_phone       TEXT NOT NULL DEFAULT '',
  order_type           TEXT NOT NULL DEFAULT 'pickup',
  delivery_address     TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  payment_status       TEXT NOT NULL DEFAULT 'pending',
  payment_method       TEXT NOT NULL DEFAULT 'card',
  source               TEXT NOT NULL DEFAULT 'online',
  subtotal             NUMERIC(10,2) NOT NULL,
  discount_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax                  NUMERIC(10,2) NOT NULL,
  delivery_fee         NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                NUMERIC(10,2) NOT NULL,
  notes                TEXT,
  kds_cleared          BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason  TEXT,
  estimated_ready_at   TIMESTAMPTZ,
  scheduled_pickup_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_status_idx         ON orders(status);
CREATE INDEX IF NOT EXISTS orders_kds_cleared_idx    ON orders(kds_cleared);
CREATE INDEX IF NOT EXISTS orders_created_at_idx     ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS orders_source_idx         ON orders(source);

CREATE TABLE IF NOT EXISTS order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id      INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_name    TEXT NOT NULL,
  menu_item_price   NUMERIC(10,2) NOT NULL,
  quantity          INTEGER NOT NULL,
  notes             TEXT,
  modifier_selections JSONB,
  subtotal          NUMERIC(10,2) NOT NULL,
  already_made      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- ── Shifts & Cash ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
  id             SERIAL PRIMARY KEY,
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  opening_float  NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_float  NUMERIC(10,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id         SERIAL PRIMARY KEY,
  shift_id   INTEGER REFERENCES shifts(id),
  type       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  amount         NUMERIC(10,2) NOT NULL,
  reason         TEXT,
  refund_method  TEXT NOT NULL DEFAULT 'cash',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── People ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  notes        TEXT,
  visit_count  INTEGER NOT NULL DEFAULT 1,
  total_spent  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'staff',
  pin_hash   TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reporting ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyverse_daily_summary (
  date        DATE PRIMARY KEY,
  gross_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  refunds     NUMERIC(10,2) NOT NULL DEFAULT 0,
  discounts   NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_sales   NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ── Settings ──────────────────────────────────────────────────────────────────

-- Operational config (open hours, payment methods, cutoff minutes, …)
-- Generic key/value store. Edited via /api/settings.
CREATE TABLE IF NOT EXISTS store_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Store IDENTITY (brand, contact, jurisdiction). Typed columns, single row
-- today (one row per tenant once multi-tenancy lands). Edited via
-- /api/store-settings. See artifacts/api-server/src/lib/store-settings.ts.
CREATE TABLE IF NOT EXISTS store_profile (
  id          SERIAL PRIMARY KEY,
  store_name  TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT NOT NULL,
  address     TEXT NOT NULL,
  tax_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
  timezone    TEXT NOT NULL DEFAULT 'America/Tortola',
  currency    TEXT NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed exactly one row on fresh installs. WHERE NOT EXISTS keeps this
-- idempotent: running schema.sql again on an existing DB is a no-op.
-- TODO(store-settings): when multi-tenancy lands, replace this seed with a
-- per-tenant provisioning step in the central admin site.
INSERT INTO store_profile (store_name, phone, email, address, tax_rate, timezone, currency)
SELECT 'Island Tacos',
       '284-544-8088',
       'orders@islandtacosbvi.com',
       'Wickhams Cay 1, Road Town, Tortola, BVI',
       0,
       'America/Tortola',
       'USD'
WHERE NOT EXISTS (SELECT 1 FROM store_profile);

-- ── Incremental column additions (safe on existing DBs) ──────────────────────
-- Add new columns here as ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- so older databases automatically get updates without data loss.

-- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kds_cleared          BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_pickup_at  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at   TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount       NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee          NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source                TEXT         NOT NULL DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method        TEXT         NOT NULL DEFAULT 'card';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status        TEXT         NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type            TEXT         NOT NULL DEFAULT 'pickup';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_tendered       NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wa_reminder_sent_at   TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS placetopay_request_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email        TEXT         NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone        TEXT         NOT NULL DEFAULT '';
-- order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS already_made          BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal              NUMERIC(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifier_selections   JSONB;
-- menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS pos_image_url          TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS loyverse_modifier_ids  TEXT[];
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS popular                BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS spicy                  BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS vegetarian             BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS open_price             BOOLEAN      NOT NULL DEFAULT false;
-- modifiers
ALTER TABLE modifiers ADD COLUMN IF NOT EXISTS unavailable_option_ids  TEXT[]       NOT NULL DEFAULT '{}';
ALTER TABLE modifiers ADD COLUMN IF NOT EXISTS sort_order              INTEGER      NOT NULL DEFAULT 0;
-- customers / employees
ALTER TABLE customers  ADD COLUMN IF NOT EXISTS visit_count            INTEGER      NOT NULL DEFAULT 1;
ALTER TABLE customers  ADD COLUMN IF NOT EXISTS total_spent            NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE customers  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW();
ALTER TABLE employees  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- ── Sequence sync (safe on fresh and existing DBs) ────────────────────────────
-- Resets each serial sequence to MAX(id)+1 so inserts never collide with
-- existing rows (common after restoring a backup or migrating data).
SELECT setval(pg_get_serial_sequence('orders','id'),         COALESCE(MAX(id),0)+1, false) FROM orders;
SELECT setval(pg_get_serial_sequence('order_items','id'),    COALESCE(MAX(id),0)+1, false) FROM order_items;
SELECT setval(pg_get_serial_sequence('menu_categories','id'),COALESCE(MAX(id),0)+1, false) FROM menu_categories;
SELECT setval(pg_get_serial_sequence('menu_items','id'),     COALESCE(MAX(id),0)+1, false) FROM menu_items;
SELECT setval(pg_get_serial_sequence('modifiers','id'),      COALESCE(MAX(id),0)+1, false) FROM modifiers;
SELECT setval(pg_get_serial_sequence('shifts','id'),         COALESCE(MAX(id),0)+1, false) FROM shifts;
SELECT setval(pg_get_serial_sequence('cash_transactions','id'),COALESCE(MAX(id),0)+1, false) FROM cash_transactions;
SELECT setval(pg_get_serial_sequence('refunds','id'),        COALESCE(MAX(id),0)+1, false) FROM refunds;
SELECT setval(pg_get_serial_sequence('customers','id'),      COALESCE(MAX(id),0)+1, false) FROM customers;
SELECT setval(pg_get_serial_sequence('employees','id'),      COALESCE(MAX(id),0)+1, false) FROM employees;
SELECT setval(pg_get_serial_sequence('store_profile','id'),  COALESCE(MAX(id),0)+1, false) FROM store_profile;
