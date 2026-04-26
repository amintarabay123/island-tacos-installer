import app from "./app";
import { logger } from "./lib/logger";
import { registerAthMovilWebhook } from "./lib/athmovil-webhook-register";
import { warmAllMenuImages } from "./routes/image-proxy";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run lightweight startup migrations (idempotent — safe to re-run on every boot)
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyverse_daily_summary (
        date DATE PRIMARY KEY,
        gross_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
        refunds NUMERIC(10,2) NOT NULL DEFAULT 0,
        discounts NUMERIC(10,2) NOT NULL DEFAULT 0,
        net_sales NUMERIC(10,2) NOT NULL DEFAULT 0
      )
    `);
  } finally {
    client.release();
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Ensure all tables exist (create any new ones added since last deploy)
  runMigrations().catch(e => logger.error({ err: e }, "Migration error"));

  // Warm all menu images on startup — loads disk cache first (no network),
  // then fetches any missing images from Loyverse CDN in the background.
  warmAllMenuImages().catch(() => {});

  // Register ATH Móvil webhook URL in production only (non-blocking)
  if (process.env["NODE_ENV"] === "production") {
    const publicUrl =
      process.env["PUBLIC_URL"] ??
      "https://orders.islandtacosbvi.com";
    registerAthMovilWebhook(`${publicUrl}/api/webhooks/athmovil`).catch(() => {});
  }
});
