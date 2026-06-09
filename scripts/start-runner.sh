#!/bin/bash
set -e

echo "Generating fresh runner registration token..."

# Generate registration token via gh API
AUTH_OWNER="thevtproject"
AUTH_REPO="recipe-app"
AUTH_ENDPOINT="repos/${AUTH_OWNER}/${AUTH_REPO}/actions/runners/registration-token"
TOKEN=$(gh api "${AUTH_ENDPOINT}" --method POST --jq '.token')
echo "${TOKEN}" > /tmp/gh_runner_token.txt

# Remove old container if exists
docker rm -f github-runner 2>/dev/null || true

# Mount host .env files for docker compose
# The checkout step clones into /home/runner/_work/recipe-app/recipe-app/
WORKSPACE_ENV_DIR=/home/runner/_work/recipe-app/recipe-app

exec docker run -d \
  --name github-runner \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/andryan/recipe-app/.env.dev:${WORKSPACE_ENV_DIR}/.env.dev:ro \
  -v /home/andryan/recipe-app/.env.prod:${WORKSPACE_ENV_DIR}/.env.prod:ro \
  recipe-app-runner:latest \
  /bin/bash -c "./config.sh --url https://github.com/thevtproject/recipe-app --token ${TOKEN} --name icon-local-runner --labels 'self-hosted,linux,x64,icon-local' --unattended --replace && ./run.sh"
