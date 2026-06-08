#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Recipe App Deployment Script"

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example and fill in secrets."
  exit 1
fi

# Check Cloudflare tunnel settings are present without sourcing .env
# (sourcing would execute shell syntax if a value is malformed).
get_env_value() {
  local key="$1"
  grep -E "^${key}=" .env 2>/dev/null | tail -n 1 | cut -d= -f2-
}

CLOUDFLARE_TUNNEL_TOKEN_VALUE="$(get_env_value CLOUDFLARE_TUNNEL_TOKEN)"
CLOUDFLARED_CONFIG_DIR_VALUE="$(get_env_value CLOUDFLARED_CONFIG_DIR)"
NEXTAUTH_URL_VALUE="$(get_env_value NEXTAUTH_URL)"

if [ -z "$CLOUDFLARE_TUNNEL_TOKEN_VALUE" ] || [ "$CLOUDFLARE_TUNNEL_TOKEN_VALUE" = "<generate from: cloudflared tunnel token recipe-app>" ]; then
  echo "ERROR: CLOUDFLARE_TUNNEL_TOKEN not set in .env."
  echo "Get token with: cloudflared tunnel token recipe-app"
  exit 1
fi

if [ -z "$CLOUDFLARED_CONFIG_DIR_VALUE" ]; then
  echo "ERROR: CLOUDFLARED_CONFIG_DIR not set in .env."
  echo "Set it to the host directory containing cloudflared config.yml and tunnel credentials JSON."
  exit 1
fi

# Stop dev server if running
if pgrep -f "next dev" > /dev/null; then
  echo "==> Stopping dev server..."
  pkill -f "next dev" || true
  sleep 2
fi

echo "==> Building Docker images..."
# --no-cache: avoid BuildKit reusing a stale builder stage when source files
# change in ways that don't invalidate the COPY layer hash (e.g. editing a
# file that was already in the previous build context). Deploys are infrequent
# (~weekly) so the ~10min cold build is fine; the cost of a silent stale-cache
# deploy shipping old code is much worse.
docker compose build --no-cache

echo "==> Starting all services..."
docker compose up -d

echo "==> Waiting for DB to be healthy..."
sleep 10

echo "==> Running Prisma migration..."
docker compose exec -T -u nextjs -e DATABASE_URL app node node_modules/prisma/build/index.js migrate deploy

echo "==> Seeding admin user..."
docker compose exec -T -u nextjs -e SEED_ADMIN_EMAIL -e SEED_ADMIN_PASSWORD -e SEED_ADMIN_NAME app node /app/prisma-compiled/seed.js || echo "(seed skipped if admin exists)"

echo ""
echo "==> ✅ Deployment complete!"
echo ""
echo "    App:    ${NEXTAUTH_URL_VALUE:-https://<your-domain>}"
echo "    Status: docker compose ps"
echo "    Logs:   docker compose logs -f app"
echo "    Tunnel: docker compose logs -f cloudflared"
echo ""
