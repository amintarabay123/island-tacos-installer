#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Island Tacos — Local Server Setup (Linux / Ubuntu)
# Run once from the PROJECT ROOT:  bash local-install/setup-linux.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
info()  { echo -e "${GREEN}✔ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠ $*${RESET}"; }
error() { echo -e "${RED}✖ $*${RESET}"; exit 1; }
step()  { echo -e "\n${BOLD}▶ $*${RESET}"; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   🌮  Island Tacos — Local Server Setup  ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Must run from project root ────────────────────────────────────────────────
[ -f "pnpm-workspace.yaml" ] || error "Run this script from the project root directory."

# ── Step 1: .env ─────────────────────────────────────────────────────────────
step "Checking .env configuration..."
if [ ! -f ".env" ]; then
  cp local-install/.env.template .env
  warn ".env file created from template."
  echo ""
  echo "  Open .env in a text editor and fill in every value:"
  echo "    nano .env"
  echo ""
  echo "  Then run this script again:  bash local-install/setup-linux.sh"
  exit 0
fi

# Quick sanity check — make sure the user actually edited the file
if grep -q "CHANGE_ME\|SAME_AS_REPLIT\|SAME_AS_CLERK" .env; then
  warn "Your .env still contains placeholder values."
  echo "  Edit .env and replace all CHANGE_ME / SAME_AS_* values, then re-run."
  exit 1
fi
info ".env looks good"

# Load env vars for use in this script
set -a
# shellcheck disable=SC1091
source .env
set +a

# ── Step 2: Node.js 20 ────────────────────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)' 2>&1; echo $?)" == "1" ]]; then
  info "Installing Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  info "Node.js $(node --version) already installed"
fi

# ── Step 3: pnpm ─────────────────────────────────────────────────────────────
step "Checking pnpm..."
if ! command -v pnpm &>/dev/null; then
  info "Installing pnpm..."
  npm install -g pnpm
else
  info "pnpm $(pnpm --version) already installed"
fi

# ── Step 4: PM2 ──────────────────────────────────────────────────────────────
step "Checking PM2..."
if ! command -v pm2 &>/dev/null; then
  info "Installing PM2..."
  npm install -g pm2
else
  info "PM2 $(pm2 --version) already installed"
fi

# ── Step 5: Install project dependencies ─────────────────────────────────────
step "Installing project dependencies..."
pnpm install --frozen-lockfile
info "Dependencies installed"

# ── Step 6: Build the API server ─────────────────────────────────────────────
step "Building API server..."
pnpm --filter @workspace/api-server run build
info "API server built"

# ── Step 7: Build the frontend ───────────────────────────────────────────────
step "Building frontend..."
# PORT is required by vite.config.ts even during build (used for dev server config)
PORT="${PORT:-3001}" \
BASE_PATH="/" \
VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
VITE_CLERK_PROXY_URL="${VITE_CLERK_PROXY_URL}" \
VITE_ADMIN_PATH="${VITE_ADMIN_PATH:-/it-admin}" \
pnpm --filter @workspace/island-tacos run build
info "Frontend built"

# ── Step 8: Push database schema ─────────────────────────────────────────────
step "Setting up database schema..."
pnpm --filter @workspace/db run push
info "Database schema ready"

# ── Step 9: Start / restart with PM2 ─────────────────────────────────────────
step "Starting Island Tacos with PM2..."
pm2 delete island-tacos 2>/dev/null || true
pm2 start local-install/ecosystem.config.cjs
pm2 save
info "Server started"

# ── Step 10: Configure auto-start on boot ────────────────────────────────────
step "Configuring auto-start on boot..."
echo ""
warn "Run the command printed below to enable auto-start on reboot (copy & paste it):"
echo ""
pm2 startup | tail -1
echo ""
info "After running that command, run:  pm2 save"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  ✅  Island Tacos is running!${RESET}"
echo ""
IP=$(hostname -I | awk '{print $1}')
echo "  Open on any device on this WiFi network:"
echo "    http://${IP}:${PORT:-3001}"
echo ""
echo "  Useful commands:"
echo "    pm2 logs island-tacos    — view live logs"
echo "    pm2 restart island-tacos — restart after updates"
echo "    pm2 stop island-tacos    — stop the server"
echo ""
