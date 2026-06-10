#!/bin/bash
set -e

echo "=== Deploy PROD ==="

cd "$(dirname "$0")/.."

# Switch to master branch, pull latest
git checkout master
git pull origin master

# Build the prod image
docker compose --env-file .env.prod build app

# Stop & remove old prod container
docker stop recipe-app-app-1 2>/dev/null || true
docker rm recipe-app-app-1 2>/dev/null || true

# Start new prod container
docker compose --env-file .env.prod up -d app

echo "=== Prod deployed: https://<prod-domain> ==="
