#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Island Tacos — Linux Local Server Updater
# Run from the project root:  bash update.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

YEL="\033[33m"; CYN="\033[36m"; GRN="\033[32m"; RED="\033[31m"; DIM="\033[2m"; RST="\033[0m"; BOLD="\033[1m"

header() {
  clear
  echo -e "${YEL}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║                                              ║"
  echo "  ║   🌮  ISLAND TACOS — Update Server          ║"
  echo "  ║                                              ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${RST}"
}
step()  { echo -e "\n${CYN}  [$1] $2${RST}"; }
ok()    { echo -e "${GRN}      ✔  $*${RST}"; }
warn()  { echo -e "${YEL}      ⚠  $*${RST}"; }
fatal() { echo -e "${RED}\n  ✖  $*${RST}\n"; exit 1; }

[ -f "pnpm-workspace.yaml" ] || fatal "Run this script from inside the Island Tacos project folder (e.g. cd /opt/island-tacos && bash update.sh)"
ROOT="$(pwd)"

# ── Load the source URL ───────────────────────────────────────────────────────
SOURCE_FILE="$ROOT/.update-source"
if [ -f "$SOURCE_FILE" ]; then
  DOWNLOAD_URL=$(cat "$SOURCE_FILE")
  echo -e "\n  Pulling updates from: ${CYN}${DOWNLOAD_URL}${RST}"
else
  echo -e "\n  ${DIM}Where is your online store hosted? (e.g. https://orders.islandtacosbvi.com)${RST}"
  printf "  Online store URL: "
  read -r BASE_URL
  BASE_URL="${BASE_URL%/}"
  DOWNLOAD_URL="${BASE_URL}/api/download/project"
  echo "$DOWNLOAD_URL" > "$SOURCE_FILE"
fi

header
echo -e "  This will download the latest code, rebuild, and restart the server."
echo -e "  ${DIM}Your settings (.env file) will NOT be changed.${RST}"
echo ""
read -rp "  Press Enter to begin..."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Backup .env
# ─────────────────────────────────────────────────────────────────────────────
header
step 1 "Backing up your configuration..."
echo ""

if [ -f "$ROOT/.env" ]; then
  cp "$ROOT/.env" /tmp/islandtacos-env-backup
  ok ".env backed up"
else
  warn "No .env file found — continuing anyway"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Download latest package
# ─────────────────────────────────────────────────────────────────────────────
header
step 2 "Downloading latest version..."
echo ""

curl -fsSL --progress-bar "$DOWNLOAD_URL" -o /tmp/island-tacos-update.tar.gz \
  || fatal "Download failed. Check that your online store is reachable: $DOWNLOAD_URL"
ok "Downloaded successfully"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Extract
# ─────────────────────────────────────────────────────────────────────────────
header
step 3 "Extracting new files..."
echo ""

tar -xzf /tmp/island-tacos-update.tar.gz -C "$ROOT" --overwrite
ok "Files updated"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Restore .env
# ─────────────────────────────────────────────────────────────────────────────
header
step 4 "Restoring your configuration..."
echo ""

if [ -f /tmp/islandtacos-env-backup ]; then
  cp /tmp/islandtacos-env-backup "$ROOT/.env"
  ok ".env restored — your settings are unchanged"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
header
step 5 "Installing dependencies..."
echo ""

pnpm install --frozen-lockfile
ok "Dependencies ready"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Rebuild
# ─────────────────────────────────────────────────────────────────────────────
header
step 6 "Rebuilding (this takes about a minute)..."
echo ""

source "$ROOT/.env" 2>/dev/null || true

echo -e "  ${DIM}  Building API server...${RST}"
pnpm --filter "@workspace/api-server" run build
ok "API server built"

echo -e "  ${DIM}  Building frontend...${RST}"
CLERK_PUB=$(grep VITE_CLERK_PUBLISHABLE_KEY "$ROOT/.env" 2>/dev/null | cut -d= -f2- || echo "")
CLERK_PROXY=$(grep VITE_CLERK_PROXY_URL "$ROOT/.env" 2>/dev/null | cut -d= -f2- || echo "")
PORT_VAL=$(grep "^PORT=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- || echo "3001")

PORT="$PORT_VAL" \
BASE_PATH="/" \
VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUB" \
VITE_CLERK_PROXY_URL="$CLERK_PROXY" \
VITE_ADMIN_PATH="/it-admin" \
pnpm --filter "@workspace/island-tacos" run build
ok "Frontend built"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Apply any database changes
# ─────────────────────────────────────────────────────────────────────────────
header
step 7 "Applying any database updates..."
echo ""

DB_URL=$(grep "^DATABASE_URL=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- || echo "")
if [ -n "$DB_URL" ]; then
  DATABASE_URL="$DB_URL" pnpm --filter "@workspace/db" run push
  ok "Database up to date"
else
  warn "DATABASE_URL not found in .env — skipping DB update"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — Restart server
# ─────────────────────────────────────────────────────────────────────────────
header
step 8 "Restarting the server..."
echo ""

pm2 restart island-tacos || pm2 start local-install/ecosystem.config.cjs
pm2 save
ok "Server restarted"

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
header
echo -e "${GRN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║   ✅  Island Tacos updated successfully!    ║"
echo "  ║                                              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${RST}"
echo -e "  ${DIM}Useful commands:${RST}"
echo -e "  ${DIM}  pm2 logs island-tacos      — view live logs${RST}"
echo -e "  ${DIM}  pm2 restart island-tacos   — restart the server${RST}"
echo ""
