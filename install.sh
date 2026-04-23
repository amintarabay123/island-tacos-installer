#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Island Tacos — Linux Local Server Installer
# Run from the project root:  bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
YEL="\033[33m"; CYN="\033[36m"; GRN="\033[32m"; RED="\033[31m"; DIM="\033[2m"; RST="\033[0m"; BOLD="\033[1m"

header() {
  clear
  echo -e "${YEL}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║                                              ║"
  echo "  ║   🌮  ISLAND TACOS — Local Server Setup     ║"
  echo "  ║                                              ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${RST}"
}
step()  { echo -e "\n${CYN}  [$1] $2${RST}"; }
ok()    { echo -e "${GRN}      ✔  $*${RST}"; }
warn()  { echo -e "${YEL}      ⚠  $*${RST}"; }
fatal() { echo -e "${RED}\n  ✖  $*${RST}\n"; exit 1; }
ask()   {
  local prompt="$1" default="${2:-}"
  if [ -n "$default" ]; then
    printf "      %s [%s]: " "$prompt" "$default"
  else
    printf "      %s: " "$prompt"
  fi
  read -r val
  echo "${val:-$default}"
}
ask_secret() {
  printf "      %s: " "$1"
  read -rs val; echo ""
  echo "$val"
}

# ── Must run from project root ────────────────────────────────────────────────
[ -f "pnpm-workspace.yaml" ] || fatal "Run this script from inside the Island Tacos project folder."
ROOT="$(pwd)"

# ─────────────────────────────────────────────────────────────────────────────
header
echo -e "  This installer will:${DIM}"
echo "    • Install Node.js, pnpm, PM2, and PostgreSQL (if not present)"
echo "    • Set up the database"
echo "    • Ask you a few questions about your setup"
echo "    • Build and start the Island Tacos server"
echo -e "${RST}"
echo "  Total time: about 5 minutes on first run."
echo ""
read -rp "  Press Enter to begin..."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Prerequisites
# ─────────────────────────────────────────────────────────────────────────────
header
step 1 "Installing prerequisites..."
echo ""

# Node.js 20
install_node=false
if command -v node &>/dev/null; then
  MAJOR=$(node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)" 2>&1 && echo ok || echo old)
  if [ "$MAJOR" = "ok" ]; then ok "Node.js $(node --version) already installed"
  else install_node=true; fi
else install_node=true; fi

if [ "$install_node" = true ]; then
  warn "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node.js $(node --version) installed"
fi

# pnpm
if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm --version) already installed"
else
  warn "Installing pnpm..."
  npm install -g pnpm
  ok "pnpm installed"
fi

# PM2
if command -v pm2 &>/dev/null; then
  ok "PM2 $(pm2 --version) already installed"
else
  warn "Installing PM2..."
  npm install -g pm2
  ok "PM2 installed"
fi

# PostgreSQL
if command -v psql &>/dev/null; then
  ok "PostgreSQL already installed"
else
  warn "Installing PostgreSQL..."
  sudo apt-get install -y postgresql
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  ok "PostgreSQL installed and started"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Configuration questions
# ─────────────────────────────────────────────────────────────────────────────
header
step 2 "Setting up your configuration..."
echo ""
echo -e "  ${DIM}Answer the questions below. Press Enter to use the default shown in [brackets].${RST}"
echo ""

# Auto-detect local IP
DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo -e "  ${DIM}── Network ──────────────────────────────────────────────────${RST}"
LOCAL_IP=$(ask "This computer's local IP address" "$DETECTED_IP")
PORT=$(ask "Port number for the server" "3001")
echo ""

echo -e "  ${DIM}── Database ─────────────────────────────────────────────────${RST}"
echo -e "  ${DIM}      Choose a password for the local database (you make this up):${RST}"
DB_PASS=$(ask_secret "Database password")
echo ""

echo -e "  ${DIM}── POS PIN Codes ────────────────────────────────────────────${RST}"
echo -e "  ${DIM}      These must match what your staff already know.${RST}"
ADMIN_PIN=$(ask_secret "Admin PIN")
STAFF_PIN=$(ask_secret "Staff PIN")
echo ""

echo -e "  ${DIM}── ATH Movil ────────────────────────────────────────────────${RST}"
echo -e "  ${DIM}      Copy these from the Replit secrets panel.${RST}"
ATH_PUBLIC=$(ask "ATH Movil Public Token")
ATH_PRIVATE=$(ask_secret "ATH Movil Private Token")
echo ""

echo -e "  ${DIM}── Clerk Authentication ─────────────────────────────────────${RST}"
echo -e "  ${DIM}      Copy these from the Replit Auth pane or Clerk dashboard.${RST}"
echo -e "  ${DIM}      Publishable key starts with pk_live_ or pk_test_${RST}"
echo -e "  ${DIM}      Secret key starts with sk_live_ or sk_test_${RST}"
CLERK_PUB=$(ask "Clerk Publishable Key")
CLERK_SECRET=$(ask_secret "Clerk Secret Key")
echo ""

echo -e "  ${DIM}── Receipt Printer (optional) ───────────────────────────────${RST}"
echo -e "  ${DIM}      Leave blank if unsure — you can set this in the POS later.${RST}"
PRINTER_IP=$(ask "Printer IP address (e.g. 192.168.8.195)" "")
echo ""

echo -e "  ${DIM}── Email (optional) ─────────────────────────────────────────${RST}"
echo -e "  ${DIM}      For order confirmation emails. Press Enter to skip.${RST}"
SMTP_PASS=$(ask_secret "SMTP Email Password (Enter to skip)")
echo ""

# Auto-generate session secret
SESSION_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Database setup
# ─────────────────────────────────────────────────────────────────────────────
header
step 3 "Setting up the database..."
echo ""

sudo -u postgres psql --quiet <<EOF 2>/dev/null || warn "Database may already exist — continuing..."
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ituser') THEN
    CREATE USER ituser WITH PASSWORD '${DB_PASS}';
  ELSE
    ALTER USER ituser WITH PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
CREATE DATABASE islandtacos OWNER ituser;
GRANT ALL PRIVILEGES ON DATABASE islandtacos TO ituser;
EOF
ok "Database 'islandtacos' ready"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Write .env
# ─────────────────────────────────────────────────────────────────────────────
header
step 4 "Writing configuration file..."
echo ""

CLERK_PROXY_URL="http://${LOCAL_IP}:${PORT}/api/__clerk"
PUBLIC_URL="http://${LOCAL_IP}:${PORT}"
DB_URL="postgresql://ituser:${DB_PASS}@localhost:5432/islandtacos"

cat > .env <<EOF
# Island Tacos — Local Server Configuration
# Generated by installer on $(date '+%Y-%m-%d %H:%M')

DATABASE_URL=${DB_URL}
PORT=${PORT}
NODE_ENV=production
PUBLIC_URL=${PUBLIC_URL}
SERVE_STATIC_PATH=./artifacts/island-tacos/dist/public

SESSION_SECRET=${SESSION_SECRET}

ADMIN_PIN=${ADMIN_PIN}
STAFF_PIN=${STAFF_PIN}

ATHMOVIL_PUBLIC_TOKEN=${ATH_PUBLIC}
ATHMOVIL_PRIVATE_TOKEN=${ATH_PRIVATE}

CLERK_SECRET_KEY=${CLERK_SECRET}
CLERK_PUBLISHABLE_KEY=${CLERK_PUB}

VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PUB}
VITE_CLERK_PROXY_URL=${CLERK_PROXY_URL}
VITE_ADMIN_PATH=/it-admin
EOF

[ -n "$SMTP_PASS"   ] && echo "SMTP_PASSWORD=${SMTP_PASS}"         >> .env
[ -n "$PRINTER_IP"  ] && echo "DEFAULT_PRINTER_IP=${PRINTER_IP}"   >> .env

ok ".env written"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
header
step 5 "Installing project dependencies..."
echo ""
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Build
# ─────────────────────────────────────────────────────────────────────────────
header
step 6 "Building the server and app (this takes a minute)..."
echo ""

echo -e "  ${DIM}  Building API server...${RST}"
pnpm --filter "@workspace/api-server" run build
ok "API server built"

echo -e "  ${DIM}  Building frontend...${RST}"
PORT="$PORT" \
BASE_PATH="/" \
VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUB" \
VITE_CLERK_PROXY_URL="$CLERK_PROXY_URL" \
VITE_ADMIN_PATH="/it-admin" \
pnpm --filter "@workspace/island-tacos" run build
ok "Frontend built"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Database schema
# ─────────────────────────────────────────────────────────────────────────────
header
step 7 "Setting up database tables..."
echo ""

export DATABASE_URL="$DB_URL"
pnpm --filter "@workspace/db" run push
ok "Database tables ready"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — Start server
# ─────────────────────────────────────────────────────────────────────────────
header
step 8 "Starting the server..."
echo ""

pm2 delete island-tacos 2>/dev/null || true
pm2 start local-install/ecosystem.config.cjs
pm2 save

# Auto-start on boot
STARTUP_CMD=$(pm2 startup 2>/dev/null | grep "sudo " | tail -1)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" 2>/dev/null || true
  pm2 save
  ok "Auto-start on boot configured"
else
  warn "Run 'pm2 startup' manually to enable auto-start on boot."
fi

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
header
echo -e "${GRN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║   ✅  Island Tacos is running!              ║"
echo "  ║                                              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${RST}"
echo "  Your server address:"
echo -e "    ${CYN}${PUBLIC_URL}${RST}"
echo ""
echo -e "  ${DIM}Open this address on any tablet or screen connected to this WiFi.${RST}"
echo ""
echo -e "  ${DIM}For receipt printing: go to POS → Printer Settings → Network mode${RST}"
[ -n "$PRINTER_IP" ] && echo -e "  ${DIM}and enter your printer IP: $PRINTER_IP${RST}"
echo ""
echo -e "  ${DIM}Useful commands:${RST}"
echo -e "  ${DIM}  pm2 logs island-tacos      — view live logs${RST}"
echo -e "  ${DIM}  pm2 restart island-tacos   — restart after updates${RST}"
echo -e "  ${DIM}  pm2 stop island-tacos      — stop the server${RST}"
echo ""
