# Recipe App

A warm, private family recipe web app with photo recipes, admin-approved accounts, and weekly meal planning.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## What it does

- Private recipe library for breakfast, lunch, dinner, snack, drink, dessert, and baby meals
- Food photo uploads with local filesystem storage
- Step-by-step recipe instructions
- Closed registration flow with admin approval before login
- Weekly meal planner for users and households
- Admin panel for user and recipe management

## Tech stack

- Next.js App Router + TypeScript
- PostgreSQL + Prisma ORM
- Auth.js credentials auth
- Tailwind CSS + shadcn/ui
- Docker Compose + Nginx + Cloudflare Tunnel

## Quickstart

```bash
cp .env.example .env
# Fill generated secrets and domain values in .env
docker compose up -d
```

For production deployment details, see [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Project status

Core app phases are complete. Current work focuses on security hardening, staging/prod deployment hygiene, and family-friendly UX improvements.

## License

See [`LICENSE`](LICENSE).
