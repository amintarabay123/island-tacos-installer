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
    },
  ],
};
