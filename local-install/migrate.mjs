#!/usr/bin/env node
// Island Tacos local DB migrator.
// Replaces the old psql-based step in UPDATE.ps1.
//
// Usage: node migrate.mjs <path-to-schema.sql>
// Reads DATABASE_URL from the environment.
//
// Designed to live at artifacts/api-server/migrate.mjs so it picks up
// the api-server's bundled `pg` dependency without a separate install.

import fs from "fs";
import pg from "pg";

const { Pool } = pg;
const sqlPath = process.argv[2];

if (!sqlPath) {
  console.error("[migrate] missing schema path argument");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set");
  process.exit(2);
}
if (!fs.existsSync(sqlPath)) {
  console.error(`[migrate] schema file not found: ${sqlPath}`);
  process.exit(2);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("[migrate] schema applied successfully");
    process.exit(0);
  } catch (e) {
    console.error(`[migrate] FAILED: ${e.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
