#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Recipe App Deployment Script"

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example and fill in secrets."
  exit 1
fi

# Check Cloudflare token
if grep -q "YOUR_CLOUDFLARE_API_TOKEN_HERE" certbot/cloudflare.ini 2>/dev/null; then
  echo "ERROR: certbot/cloudflare.ini still has placeholder token."
  echo "Get your token at: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

# Stop dev server if running
if pgrep -f "next dev" > /dev/null; then
  echo "==> Stopping dev server..."
  pkill -f "next dev" || true
  sleep 2
fi

# First boot: use HTTP-only nginx config
if [ ! -d "$(docker volume inspect recipe-app_certbot_certs -f '{{ .Mountpoint }}' 2>/dev/null)/live/recipes.thevtproject.my.id" ]; then
  echo "==> First boot: TLS cert doesn't exist yet, using HTTP-only config..."
  cp nginx/default.conf nginx/default.conf.backup
  cp nginx/default.conf.nossl nginx/default.conf
  FIRST_BOOT=1
else
  FIRST_BOOT=0
fi

echo "==> Building Docker images..."
docker compose build --no-cache

echo "==> Starting services (DB + App + Nginx)..."
docker compose up -d db app nginx

echo "==> Waiting for DB to be healthy..."
sleep 10

echo "==> Running Prisma migration..."
docker compose exec -T app npx prisma migrate deploy

echo "==> Seeding admin user..."
docker compose exec -T app npx prisma db seed || echo "(seed skipped if admin exists)"

if [ "$FIRST_BOOT" -eq 1 ]; then
  echo "==> Obtaining TLS certificate..."
  docker compose run --rm certbot
  
  echo "==> Restoring full Nginx config with HTTPS..."
  mv nginx/default.conf.backup nginx/default.conf
  
  echo "==> Reloading Nginx..."
  docker compose restart nginx
fi

echo ""
echo "==> ✅ Deployment complete!"
echo ""
echo "    Local:  https://recipes.thevtproject.my.id (after port forwarding 443)"
echo "    Status: docker compose ps"
echo "    Logs:   docker compose logs -f app"
echo ""
