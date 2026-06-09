#!/bin/bash
set -e
echo "Generating fresh runner registration token..."
OWNER="thevtproject"
REPO="recipe-app"
ENDPOINT="repos/${OWNER}/${REPO}/actions/runners/registration-token"
TOKEN=$(gh api "${ENDPOINT}" --method POST --jq '.token')
echo "${TOKEN}" > /tmp/gh_runner_token.txt
docker rm -f github-runner 2>/dev/null || true
RN="icon-runner-$(date +%s)"
exec docker run -d \
  --name github-runner \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/andryan/recipe-app:/host-repo:ro \
  recipe-app-runner:latest \
  /bin/bash -c "rm -f /home/runner/.credentials && ./config.sh --url https://github.com/thevtproject/recipe-app --token ${TOKEN} --name ${RN} --labels self-hosted,linux,x64,icon-local --unattended --replace && ./run.sh"
