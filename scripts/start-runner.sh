#!/bin/bash
set -e

TOKEN=$(cat /tmp/gh_runner_token.txt | tr -d '\n' 2>/dev/null)
if [ -z "$TOKEN" ]; then
  # Try to regenerate using gh CLI
  echo "Generating fresh token..." >&2
  TOKEN=$(gh api repos/thevtproject/recipe-app/actions/runners/registration-token --method POST --jq '.token')
  echo "$TOKEN" > /tmp/gh_runner_token.txt
fi

docker rm -f github-runner 2>/dev/null || true

exec docker run -d \
  --name github-runner \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/actions/actions-runner:latest \
  /bin/bash -c "./config.sh --url https://github.com/thevtproject/recipe-app --token ${TOKEN} --name icon-local-runner --labels 'self-hosted,linux,x64,icon-local' --unattended --replace && ./run.sh"
