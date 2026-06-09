#!/bin/bash
set -e

echo "Generating fresh runner registration token..."

OWNER="thevtproject"
REPO="recipe-app"
ENDPOINT="repos/${OWNER}/${REPO}/actions/runners/registration-token"

# Generate registration token via gh API
TOKEN=$(gh api "${ENDPOINT}" --method POST --jq '.token')
echo "${TOKEN}" > /tmp/gh_runner_token.txt

# Remove old runner container if exists
docker rm -f github-runner 2>/dev/null || true

# Mount host recipe-app at /host-repo for workflow env file copy
exec docker run -d   --name github-runner   --restart unless-stopped   -v /var/run/docker.sock:/var/run/docker.sock   -v /home/andryan/recipe-app:/host-repo:ro   recipe-app-runner:latest   /bin/bash -c 'rm -f .credentials && \
    ./config.sh --url https://github.com/thevtproject/recipe-app     --token '"${TOKEN}"'     --name icon-local-runner     --labels "self-hosted,linux,x64,icon-local"     --unattended --replace && \
    ./run.sh'
