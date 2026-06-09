#!/bin/bash
set -e

TOKEN_FILE=/tmp/gh_runner_token.txt
TOKEN=$(head -1 "$TOKEN_FILE" 2>/dev/null | tr -d '\n')
if [ -z "$TOKEN" ]; then
  echo "Generating fresh token..." >&2
  TOKEN=$(gh api repos/thevtproject/recipe-app/actions/runners/registration-token --method POST --jq '.token')
  echo "$TOKEN" > "$TOKEN_FILE"
fi

docker rm -f github-runner 2>/dev/null || true

exec docker run -d \
  --name github-runner \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  recipe-app-runner:latest \
  /bin/bash -c "./config.sh --url https://github.com/thevtproject/recipe-app --token ${TOKEN} --name icon-local-runner --labels 'self-hosted,linux,x64,icon-local' --unattended --replace && ./run.sh"
