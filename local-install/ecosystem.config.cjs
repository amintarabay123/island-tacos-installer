/**
 * PM2 ecosystem config for Island Tacos local server.
 * This file lives in local-install/ — project root is one level up.
 * PM2 command: pm2 start local-install/ecosystem.config.cjs
 */
const path = require("path");
const fs   = require("fs");

const root    = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

// Parse .env file and pass variables explicitly — more reliable than env_file option
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    // Strip \r explicitly in case file was written with Windows CRLF line endings
    const key = trimmed.slice(0, idx).trim().replace(/\r/g, "");
    const val = trimmed.slice(idx + 1).trim().replace(/\r/g, "");
    env[key] = val;
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "island-tacos",
      script: "node",
      args: `--enable-source-maps ${path.join(root, "artifacts/api-server/dist/index.mjs")}`,
      cwd: root,
      env: {
        ...loadEnv(envPath),
        // Hardcoded overrides — these are guaranteed to reach the process
        // regardless of .env encoding or parsing issues on Windows.
        PORT: "3001",
        SERVE_STATIC_PATH: "./artifacts/island-tacos/dist/public",
        BASE_PATH: "/",
        ADMIN_PATH: "admin",
      },
      watch: false,
      autorestart: true,
      max_restarts: 50,
      min_uptime: "5s",
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      windowsHide: true,
    },
    {
      // Watchdog: polls services every 30 s, auto-repairs, escalates via SMS + OpenAI.
      // Outputs: local-install/monitor-status.json + local-install/monitor-events.json
      // consumed by GET /api/system/health.
      //
      // Required env vars (in .env) for full functionality:
      //   OPENAI_API_KEY          — OpenAI GPT-4o-mini diagnosis on escalation
      //   MONITOR_ALERT_PHONE     — E.164 phone to receive SMS alerts (e.g. +12845551234)
      //   SMS_GATEWAY_URL/USERNAME/PASSWORD — local Android SMS gateway
      //   PRINTER_IP              — thermal printer IP for TCP check (optional)
      //   PRINTER_PORT            — printer port (default 9100)
      name: "island-tacos-monitor",
      script: "node",
      // --no-warnings suppresses the node:sqlite ExperimentalWarning in PM2 logs
      args: `--no-warnings ${path.join(root, "local-install/monitor.mjs")}`,
      cwd: root,
      env: {
        ...loadEnv(envPath),
        NODE_ENV: "production",
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: "10s",
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: "64M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      windowsHide: true,
    },
  ],
};
