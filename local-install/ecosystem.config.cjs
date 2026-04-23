/**
 * PM2 ecosystem config for Island Tacos local server.
 * This file lives in local-install/ — project root is one level up.
 * PM2 command: pm2 start local-install/ecosystem.config.cjs
 */
const path = require("path");

const root = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "island-tacos",
      script: "node",
      args: `--enable-source-maps ${path.join(root, "artifacts/api-server/dist/index.mjs")}`,
      cwd: root,
      env_file: path.join(root, ".env"),
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
