#!/bin/bash
set -e

echo "=== Deploy DEV ==="

cd "$(dirname "$0")/.."

# Switch to dev branch, pull latest
git checkout dev
git pull origin dev

# Build the dev image
docker compose build app-dev

# Stop & remove old dev container
docker stop recipe-app-app-dev-1 2>/dev/null || true
docker rm recipe-app-app-dev-1 2>/dev/null || true

# Start new dev container
docker compose up -d app-dev

echo "=== Dev deployed: https://dev.vtproject.my.id ==="
