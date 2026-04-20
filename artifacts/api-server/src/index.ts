import app from "./app";
import { logger } from "./lib/logger";
import { registerAthMovilWebhook } from "./lib/athmovil-webhook-register";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Register ATH Móvil webhook URL in production only (non-blocking)
  if (process.env["NODE_ENV"] === "production") {
    registerAthMovilWebhook("https://order-direct-connect.replit.app/api/webhooks/athmovil").catch(() => {});
  }
});
