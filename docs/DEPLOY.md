# Production Deployment Guide

Domain: **recipes.thevtproject.my.id**  
Server: icon.local (192.168.1.215, Ubuntu, behind NAT)  
Stack: Docker Compose + Nginx + Let's Encrypt DNS-01 (Cloudflare)

---

## Prerequisites

### 1. Cloudflare Setup

1. Create free account at [cloudflare.com](https://cloudflare.com)
2. Add domain `thevtproject.my.id` to Cloudflare
3. At Rumahweb, change nameservers to Cloudflare's (shown in CF dashboard after adding domain)
   - Wait 1-24h for propagation
4. In Cloudflare DNS, add A record:
   ```
   Type: A
   Name: recipes
   IPv4: 157.85.210.21
   Proxy: OFF (gray cloud)
   TTL: Auto
   ```
5. Create API token:
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Create Token → Edit zone DNS template
   - Zone Resources: Include → Specific zone → thevtproject.my.id
   - Copy the token

### 2. Home Router Port Forwarding

Forward these ports to **192.168.1.215**:
- Port 443 (HTTPS)
- Port 80 (HTTP, optional — only for redirects)

Check router manual for your specific device.

### 3. Server Setup

Install Docker + Docker Compose if not already:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

---

## Deployment Steps

### 1. Configure Environment

```bash
cd /home/andryan/recipe-app

# Copy and edit .env
cp .env.example .env
nano .env
```

Fill in:
```bash
POSTGRES_PASSWORD=<generate strong password>
NEXTAUTH_SECRET=<run: openssl rand -base64 48>
NEXTAUTH_URL=https://recipes.thevtproject.my.id
CERTBOT_EMAIL=your@email.com
SEED_ADMIN_EMAIL=admin@family.local
SEED_ADMIN_PASSWORD=<your secure admin password>
```

### 2. Configure Cloudflare API Token

```bash
nano certbot/cloudflare.ini
```

Replace `YOUR_CLOUDFLARE_API_TOKEN_HERE` with the token from step 1.5 above.

### 3. Run Deployment Script

```bash
./deploy.sh
```

This script will:
1. Build Docker images
2. Start DB + App + Nginx (HTTP-only first)
3. Run Prisma migrations
4. Seed admin user
5. Obtain TLS cert via DNS-01
6. Switch Nginx to HTTPS config
7. Reload Nginx

First run takes ~5-10 minutes (build + cert issuance).

### 4. Verify

```bash
docker compose ps
# All services should show "Up"

docker compose logs -f app
# Check for errors
```

### 5. Access

Open **https://recipes.thevtproject.my.id** (from any device, anywhere).

Login with:
- Email: `admin@family.local` (or what you set in SEED_ADMIN_EMAIL)
- Password: what you set in SEED_ADMIN_PASSWORD

---

## Maintenance

### View logs
```bash
docker compose logs -f app
docker compose logs -f nginx
```

### Restart services
```bash
docker compose restart app
docker compose restart nginx
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

### Renew TLS cert (auto-renews, but manual if needed)
```bash
docker compose run --rm certbot renew
docker compose restart nginx
```

### Backup database
```bash
docker compose exec db pg_dump -U recipe_user recipe_db > backup_$(date +%F).sql
```

### Restore database
```bash
cat backup_2026-06-04.sql | docker compose exec -T db psql -U recipe_user recipe_db
```

---

## Troubleshooting

### "502 Bad Gateway"
- Check app is running: `docker compose ps`
- Check app logs: `docker compose logs app`
- Restart: `docker compose restart app`

### "Connection refused"
- Check port forwarding on router (443 → 192.168.1.215:443)
- Check firewall: `sudo ufw status` (should allow 80/443)

### Cert issuance fails
- Verify Cloudflare token has `Zone:DNS:Edit` permission
- Check nameservers propagated: `dig NS thevtproject.my.id`
- Check DNS record exists: `dig recipes.thevtproject.my.id`

### App can't connect to DB
- Check `DATABASE_URL` in `.env` matches docker-compose service name (`db`)
- Check DB is healthy: `docker compose exec db pg_isready -U recipe_user`

---

## Security Notes

- `.env` and `certbot/cloudflare.ini` are gitignored — never commit secrets
- Postgres is on internal network only (not exposed to host)
- Nginx terminates TLS, app runs HTTP internally
- Photos stored in Docker volume `recipe-app_uploads`
- Database stored in Docker volume `recipe-app_pgdata`

---

## Next Steps (Optional)

- Set up automated backups (cron + rclone to cloud storage)
- Configure Cloudflare firewall rules
- Add monitoring (uptime checks, error alerts)
- Set up staging environment on a separate subdomain
