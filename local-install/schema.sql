-- Island Tacos — Database Schema
-- Safe to run on existing databases (uses CREATE TABLE IF NOT EXISTS)
-- Run: psql -U ituser -d islandtacos -f schema.sql

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

CREATE TABLE IF NOT EXISTS store_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Incremental column additions (safe on existing DBs) ──────────────────────
-- Add new columns here as ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- so older databases automatically get updates without data loss.

ALTER TABLE orders      ADD COLUMN IF NOT EXISTS kds_cleared         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders      ADD COLUMN IF NOT EXISTS scheduled_pickup_at TIMESTAMPTZ;
ALTER TABLE orders      ADD COLUMN IF NOT EXISTS discount_amount      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS already_made         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal             NUMERIC(10,2);
ALTER TABLE menu_items  ADD COLUMN IF NOT EXISTS pos_image_url        TEXT;
ALTER TABLE menu_items  ADD COLUMN IF NOT EXISTS loyverse_modifier_ids TEXT[];
ALTER TABLE modifiers   ADD COLUMN IF NOT EXISTS unavailable_option_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE modifiers   ADD COLUMN IF NOT EXISTS sort_order            INTEGER NOT NULL DEFAULT 0;
