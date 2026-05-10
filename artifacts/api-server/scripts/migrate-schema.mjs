#!/usr/bin/env node
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set — skipping schema update.");
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  {
    name: "orders.amount_tendered",
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_tendered numeric(10,2)`,
  },
];

(async () => {
  let ok = 0;
  let fail = 0;
  for (const s of statements) {
    try {
      await pool.query(s.sql);
      console.log(`[migrate] OK  ${s.name}`);
      ok++;
    } catch (e) {
      console.error(`[migrate] ERR ${s.name}: ${e.message}`);
      fail++;
    }
  }
  await pool.end();
  console.log(`[migrate] done — ${ok} ok, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
