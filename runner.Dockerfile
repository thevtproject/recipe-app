FROM ghcr.io/actions/actions-runner:latest

USER root

# Install Docker CLI plugin for docker compose (v2)
RUN mkdir -p /usr/local/lib/docker/cli-plugins && \
    curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Pre-create runner work directories with correct permissions
RUN mkdir -p /home/runner/_work /home/runner/_work/_tool /home/runner/_work/_temp && \
    chown -R runner:runner /home/runner/_work /home/runner/_work/_tool /home/runner/_work/_temp

USER runner
