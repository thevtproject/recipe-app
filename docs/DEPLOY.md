# Production Deployment Guide

Domain: **<your-domain>**  
Server: <server-hostname> (<server-ip>, behind NAT, no public IP)  
Stack: Docker Compose + Nginx + Cloudflare Tunnel

---

## Why Cloudflare Tunnel (not Certbot + port forwarding)

The home ISP assigns a **dynamic public IP** and the router has **no inbound port forwarding** (CGNAT in some ISPs blocks this). Certbot DNS-01 still works for cert issuance, but **traffic can't reach the server** without port forwarding.

Cloudflare Tunnel solves both: an outbound-only `cloudflared` connection from the server to Cloudflare's edge, which then routes `<your-domain>` through that tunnel. No public IP, no port forwarding, free TLS at the edge.

If you DO have a fixed public IP + port forwarding, you can revert to Certbot + open 80/443 — but this guide assumes the tunnel approach.

---

## Prerequisites

### 1. Cloudflare Setup

1. Create free account at [cloudflare.com](https://cloudflare.com)
2. Add domain `<your-domain>` to Cloudflare
3. At Rumahweb, change nameservers to Cloudflare's (shown in CF dashboard after adding domain). Wait 1-24h for propagation.
4. In Cloudflare dashboard, create a Tunnel:
   - Go to: Zero Trust → Networks → Tunnels
   - Create a tunnel named `recipe-app`
   - Copy the **Tunnel Token** (long base64 string)
5. Add a **Public Hostname** to the tunnel:
   - Subdomain: `recipes`
   - Domain: `<your-domain>`
   - Service: `http://nginx:80` (or `http://localhost:80` if you prefer host-routed)

### 2. Server Setup

Install Docker + the Compose v2 plugin (Ubuntu's apt has only the old `docker-compose` v1):

```bash
# Remove old docker-compose v1 if present
sudo apt remove docker-compose 2>/dev/null
sudo apt update

# Install Docker from official repo (has the v2 plugin)
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

---

## Deployment Steps

### 1. Configure Environment

```bash
cd ~/recipe-app
cp .env.example .env
nano .env
```

Required values:
```bash
POSTGRES_PASSWORD=<generate strong password>
NEXTAUTH_SECRET=<run: openssl rand -base64 48>
NEXTAUTH_URL=https://<your-domain>
CLOUDFLARE_TUNNEL_TOKEN=<paste token from step 1.4>
SEED_ADMIN_EMAIL=<admin-email>
SEED_ADMIN_PASSWORD=<your secure admin password>
```

### 2. Configure Tunnel Locally (NOT using TUNNEL_TOKEN)

The tokenized approach fetches empty ingress from the API. Use a bind-mounted config + credentials file instead:

```bash
mkdir -p ~/.cloudflared
# Copy credentials file from Cloudflare (or use `cloudflared tunnel login` then `cloudflared tunnel create recipe-app`)
# The credentials JSON sits at ~/.cloudflared/<tunnel-uuid>.json
chmod 700 ~/.cloudflared
chmod 644 ~/.cloudflared/config.yml ~/.cloudflared/<tunnel-uuid>.json
```

`~/.cloudflared/config.yml`:
```yaml
tunnel: <tunnel-uuid>
credentials-file: /etc/cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: <your-domain>
    service: http://nginx:80
  - service: http_status:404
```

The `cloudflared` container bind-mounts `~/.cloudflared:/etc/cloudflared:ro` and runs:
```
tunnel --no-autoupdate --config /etc/cloudflared/config.yml run
```

### 3. Run Deployment Script

```bash
./deploy.sh
```

This script:
1. Builds the multi-stage app image (deps, builder, runner; tsc-compiles seed.ts to JS)
2. Starts DB, App, Nginx, Cloudflared
3. Waits for DB to be healthy
4. Runs `node node_modules/prisma/build/index.js migrate deploy` (avoids `npx` network call)
5. Seeds admin user via compiled `prisma-compiled/seed.js`

First run takes ~5 minutes (npm install + Next.js build).

### 4. Verify

```bash
docker compose ps
# All 4 services: db, app, nginx, cloudflared

docker compose logs --tail=20 cloudflared
# Look for: "registered tunnel connection" and "Connection established"

curl -sI https://<your-domain>
# Expected: HTTP/2 307 → /login (when not logged in)
```

### 5. Access

Open **https://<your-domain>** (from any device, anywhere).

Login with:
- Email: `<admin-email>`
- Password: `SEED_ADMIN_PASSWORD` from `.env`

---

## Critical Build Notes (gothas hit during deployment)

These are the things that WILL trip you up if you skip them:

1. **Prisma `binaryTargets`** — Alpine runtime (musl) needs `linux-musl-openssl-3.0.x`. Add to `schema.prisma`:
   ```prisma
   generator client {
     provider      = "prisma-client-js"
     binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
   }
   ```
2. **Prisma engine files** — The runner image must COPY `.prisma`, `@prisma`, `prisma`, and `.bin` from the builder. Otherwise `prisma migrate deploy` errors with `ENOENT prisma_schema_build_bg.wasm`.
3. **Seed script** — Don't ship `tsx` in the runner. Compile `prisma/seed.ts` to `prisma-compiled/seed.js` at build time with `tsc`. Run via `node /app/prisma-compiled/seed.js`.
4. **Migration command** — Use `node node_modules/prisma/build/index.js migrate deploy`, NOT `npx prisma migrate deploy`. The latter tries to reach npm registry and fails on the internal Docker network.
5. **NextAuth `trustHost: true`** — Without it, production refuses the `<your-domain>` Host header (UntrustedHost error). Required when behind a tunnel/reverse proxy.
6. **Edge-safe auth config** — Middleware runs in the edge runtime; it can't import `prisma` or `bcryptjs`. Split into `auth.config.ts` (edge-safe, no providers) and `lib/auth.ts` (Node, full providers). Middleware imports the edge one.

---

## Maintenance

### View logs
```bash
docker compose logs -f app
docker compose logs -f cloudflared
```

### Restart services
```bash
docker compose restart app
docker compose restart cloudflared
```

### Stop all
```bash
docker compose down
```

### Update code
```bash
git pull
docker compose build app
docker compose up -d app
```

### Add a new Prisma migration
```bash
# On host: edit prisma/schema.prisma
docker compose exec app node node_modules/prisma/build/index.js migrate dev --name <name>
# Then rebuild the image so the migration ships:
docker compose build app && docker compose up -d app
```

### Backup database
```bash
docker compose exec db pg_dump -U recipe_user recipe_db > backup_$(date +%F).sql
```

### Restore database
```bash
cat backup_2026-06-04.sql | docker compose exec -T db psql -U recipe_user recipe_db
```

### Reset admin password
```bash
docker compose exec -u nextjs app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('NEW_PASSWORD_HERE', 12);
  await p.user.update({ where: { email: '<admin-email>' }, data: { password: hash } });
  console.log('Password reset OK');
  await p.\$disconnect();
})();
"
```

---

## Troubleshooting

### "503 from Cloudflare" / "No ingress rules"
Tunnel config file isn't being read. Check:
- Bind mount exists: `docker compose exec cloudflared ls -la /etc/cloudflared/`
- File perms: `chmod 644 ~/.cloudflared/*.yml ~/.cloudflared/*.json`
- Restart: `docker compose up -d cloudflared`

### "UntrustedHost" in app logs
Missing `trustHost: true` in `auth.config.ts`. Rebuild app.

### "PrismaClientInitializationError: openssl"
Missing `linux-musl-openssl-3.0.x` binary target. Update schema, run `npx prisma generate` on host, rebuild.

### App can't reach npm during build
Run `npx prisma generate` on the host before `docker compose build`, OR ensure the internal Docker network doesn't have `internal: true`.

### Disk full during build
```bash
docker builder prune -af  # Reclaim 5+ GB of stale buildx cache
```

### Migration fails: "User already exists"
The seed has already run. Either ignore, or reset:
```bash
docker compose exec -u nextjs app node /app/prisma-compiled/seed.js
```

---

## Security Notes

- `.env` and `~/.cloudflared/*.json` are gitignored — never commit secrets
- Postgres is on internal network only (not exposed to host)
- App runs as non-root user `nextjs` (uid 1001)
- Migration/seed run as root in the container, then the app drops back to `nextjs`
- Photos stored in Docker volume `recipe-app_uploads` (not committed to git)
- Database stored in Docker volume `recipe-app_pgdata`
- Cloudflare Tunnel is the only inbound — no public ports open on the server

---

## Next Steps (Optional)

- Set up automated backups (cron + rclone to cloud storage)
- Configure Cloudflare Zero Trust Access policies (e.g. email OTP gate)
- Add uptime monitoring (Cloudflare has free health checks, or use Healthchecks.io)
- Set up a staging environment on `staging.<your-domain>`
- Add CI/CD: GitHub Actions to auto-build and push images on push to main
