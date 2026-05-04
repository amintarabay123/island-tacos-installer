/**
 * Island Tacos — Sales Data Importer
 * Usage: node import-sales.cjs <path-to-sales-export.json>
 * Example: node import-sales.cjs C:\IslandTacos\sales-export.json
 *
 * Reads the JSON export from orders.islandtacosbvi.com/api/download/sales-export
 * and inserts all rows into the local PostgreSQL database using parameterized queries.
 * Rows that already exist (same id) are skipped safely.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node import-sales.cjs <path-to-sales-export.json>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));

// Read DATABASE_URL from .env in project root (one level up from local-install)
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL not found in .env or environment");
  process.exit(1);
}

async function importTable(client, table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ${table}: no rows to import`);
    return 0;
  }
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const vals = cols.map(c => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    try {
      const result = await client.query(
        `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        vals
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(`  WARN: skipping row id=${row.id} in ${table}: ${err.message}`);
      skipped++;
    }
  }
  return { inserted, skipped };
}

async function resetSequence(client, table, seqName) {
  await client.query(
    `SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`
  );
}

async function main() {
  console.log(`\nIsland Tacos Sales Importer`);
  console.log(`Export date: ${data.generatedAt}`);
  console.log(`Orders: ${data.orders?.length ?? 0}`);
  console.log(`Order items: ${data.order_items?.length ?? 0}`);
  console.log(`Shifts: ${data.shifts?.length ?? 0}`);
  console.log(`Cash transactions: ${data.cash_transactions?.length ?? 0}`);
  console.log(`Refunds: ${data.refunds?.length ?? 0}\n`);

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to local database.\n");

  try {
    const tables = [
      { name: "orders",            seq: "orders_id_seq",            rows: data.orders },
      { name: "order_items",       seq: "order_items_id_seq",       rows: data.order_items },
      { name: "shifts",            seq: "shifts_id_seq",            rows: data.shifts },
      { name: "cash_transactions", seq: "cash_transactions_id_seq", rows: data.cash_transactions },
      { name: "refunds",           seq: "refunds_id_seq",           rows: data.refunds },
    ];

    for (const { name, seq, rows } of tables) {
      process.stdout.write(`Importing ${name}... `);
      const result = await importTable(client, name, rows);
      if (result && typeof result === "object") {
        console.log(`${result.inserted} inserted, ${result.skipped} skipped`);
      }
      await resetSequence(client, name, seq);
    }

    console.log("\nVerifying import:");
    const check = await client.query(
      "SELECT count(*) as orders, sum(total)::numeric(10,2) as revenue FROM orders"
    );
    const row = check.rows[0];
    console.log(`  Orders in local DB: ${row.orders}`);
    console.log(`  Total revenue:      $${row.revenue}`);
    console.log("\nDone!");
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
