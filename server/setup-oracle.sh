#!/usr/bin/env bash
set -e

# ============================================================
# Oracle Cloud Free Tier — RS GYM WhatsApp Server Setup
# Ek command me sab kuch install + configure
# ============================================================

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

log()  { echo -e "${CYAN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[-]${NC} $1"; }
ok()   { echo -e "${GREEN}[✔]${NC} $1"; }

# ── Check root ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Is script ko root user se chalayein: sudo bash setup-oracle.sh"
  exit 1
fi

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║     RS GYM — Oracle Cloud Setup Script      ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: System Update + Dependencies ───────────────────
log "System update aur dependencies install ho rahe hain..."

apt update && apt upgrade -y
apt install -y curl git chromium-browser nginx ufw

ok "System updated, base dependencies installed"

# ── Step 2: Node.js 20 ──────────────────────────────────────
log "Node.js 20 install ho raha hai..."

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
ok "Node.js ${NODE_VER}, npm ${NPM_VER} installed"

# ── Step 3: Clone repo ──────────────────────────────────────
REPO_DIR="/opt/rsgym"
if [[ -d "$REPO_DIR" ]]; then
  warn "$REPO_DIR already exists. Pulling latest..."
  cd "$REPO_DIR" && git pull
else
  log "Cloning repo..."
  mkdir -p "$REPO_DIR"
  git clone https://github.com/lordshiva09/GYM-MANAGEMENT-SYSTEM.git "$REPO_DIR"
fi

cd "$REPO_DIR/server"
ok "Repo cloned to $REPO_DIR"

# ── Step 4: Environment variables ─────────────────────────
ENV_FILE="$REPO_DIR/server/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env file already exists at $ENV_FILE — skipping"
else
  echo ""
  warn "MongoDB Atlas connection string daalein (MONGODB_URI):"
  read -r -p "> " MONGODB_URI

  if [[ -z "$MONGODB_URI" ]]; then
    err "MONGODB_URI required hai. Script abort."
    exit 1
  fi

  cat > "$ENV_FILE" <<EOF
PORT=3001
MONGODB_URI=$MONGODB_URI
EOF
  ok ".env file created at $ENV_FILE"
fi

# ── Step 5: Install npm packages ──────────────────────────
log "npm packages install ho rahe hain (ye 2-5 min le sakta hai)..."

npm install

ok "npm packages installed"

# ── Step 6: PM2 install + configure ───────────────────────
log "PM2 install ho raha hai..."

npm install -g pm2

pm2 delete gym-server 2>/dev/null || true
pm2 start server.js --name gym-server
pm2 save

env PATH=\$PATH:/usr/bin pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

ok "PM2 configured — server auto-restart on reboot enabled"

# ── Step 7: Firewall ──────────────────────────────────────
log "Firewall (UFW) configure ho raha hai..."

ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable 2>/dev/null || warn "UFW enable failed (might already be active)"

ok "Firewall ports 22, 80, 443 open"

# ── Step 8: Nginx reverse proxy ───────────────────────────
NGINX_CONF="/etc/nginx/sites-available/rsgym"
if [[ ! -f "$NGINX_CONF" ]]; then
  cat > "$NGINX_CONF" <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default

  # test nginx config
  nginx -t && systemctl restart nginx
  ok "Nginx reverse proxy configured (port 80 → 3001)"
else
  warn "Nginx config already exists — skipping"
fi

# ── Step 9: Show QR ──────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  ${YELLOW}SETUP COMPLETE!${NC} ${BOLD}                                  ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}  ${CYAN}Server:${NC} http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VM_IP')  ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${CYAN}PM2:${NC} pm2 logs gym-server                          ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${CYAN}Repo:${NC} $REPO_DIR                           ${BOLD}║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}  ${YELLOW}WhatsApp QR scan karna hai:${NC}                       ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${YELLOW}Run karein:${NC} pm2 logs gym-server                  ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${YELLOW}Terminal me QR aayega → WhatsApp Web se scan${NC}      ${BOLD}║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}PM2 commands:${NC}"
echo -e "  pm2 logs gym-server        ${YELLOW}# WhatsApp QR + logs dekhne${NC}"
echo -e "  pm2 restart gym-server     ${YELLOW}# restart${NC}"
echo -e "  pm2 stop gym-server        ${YELLOW}# stop${NC}"
echo ""

# ── Step 10: Show QR directly ────────────────────────────
log "Server start ho raha hai — QR code scan karein jab terminal me dikhe..."
cd "$REPO_DIR/server"
pm2 restart gym-server
sleep 3
pm2 logs gym-server --lines 20
