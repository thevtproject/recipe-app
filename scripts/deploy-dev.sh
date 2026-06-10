#!/bin/bash
set -e

echo "=== Deploy DEV ==="

cd "$(dirname "$0")/.."

# Switch to dev branch, pull latest
git checkout dev
git pull origin dev

# Ensure dev database container is running
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d db-dev

# Build the dev image
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml build app-dev

# Run migrations against the separate dev database
echo "Running migrations against dev database..."
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml run --rm migrate-dev

# Stop & remove old dev container
docker stop recipe-app-app-dev-1 2>/dev/null || true
docker rm recipe-app-app-dev-1 2>/dev/null || true

# Start new dev container
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d app-dev

echo "=== Dev deployed: https://<dev-domain> ==="
