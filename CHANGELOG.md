# CHANGELOG.md

All notable changes to this project documented here.
Format: [version] [date] — [description]

## [1.0.0] — 2026-06-04 🚀

### Phase 4 — SysOps (Production-Ready)
- Dockerfile — multi-stage (deps, builder, runner), standalone Next.js, non-root user
- docker-compose.yml — 4 services: db (postgres:16-alpine), app (Next.js standalone), nginx (alpine), certbot (dns-cloudflare)
- Nginx reverse proxy — HTTP→HTTPS redirect, TLS termination, security headers (HSTS, X-Frame-Options, nosniff)
- Certbot DNS-01 — Cloudflare plugin for automated TLS cert issuance/renewal, no inbound port 80/443 needed
- .env.example — all production env vars documented
- next.config.mjs — output: standalone, bcryptjs externalized, image domains whitelisted
- deploy.sh — automated first-boot: HTTP-only → cert issuance → HTTPS switch → migration → seed
- docs/DEPLOY.md — full production guide: Cloudflare setup, port forwarding, troubleshooting, backup/restore

## [0.3.0] — 2026-06-04

### Phase 3 — Meal Planner
- FullCalendar v6 (@fullcalendar/react, daygrid, timegrid, interaction)
- GET/POST /api/meal-plans — date-range fetch, upsert by userId+date+mealType
- DELETE /api/meal-plans/[id] — owner-only removal
- RecipePicker dialog — searchable, pre-filtered by meal type
- WeeklyPlanner component — timeGridWeek view, click slot → RecipePicker → assign, trash icon to remove
- Japandi CSS overrides for FullCalendar toolbar and events

## [0.2.0] — 2026-06-04

### Phase 2 — Recipe Engine
- GET/POST /api/recipes with category filter (BREAKFAST/LUNCH/DINNER)
- GET/PATCH/DELETE /api/recipes/[id] — owner or ADMIN authorization
- POST /api/uploads — magic byte MIME validation, 5MB cap, uuid filename, local filesystem
- Recipe list page /recipes — tabs filter, responsive 3-col card grid, loading skeleton, empty state
- Recipe detail page /recipes/[id] — full photo, numbered step cards, author/admin edit link
- Add recipe page /recipes/new — full-page RecipeForm
- Edit recipe page /recipes/[id]/edit — server-side owner/admin gate
- Shared RecipeForm component — inline photo upload, dynamic steps list, category picker

## [0.1.0] — 2026-06-04

### Phase 1 — Scaffold + Auth
- Next.js 14.2.35 App Router, TypeScript strict, Tailwind CSS, shadcn/ui (base-nova style)
- Japandi design system: warm beige bg (#F5F0EB), stone text, warm sand accent — oklch CSS vars
- PostgreSQL + Prisma 5 schema: User (isApproved, role), Recipe, MealPlan
- Auth.js v5 (next-auth@beta.31) credentials provider with bcrypt + isApproved gate
- JWT/session callbacks propagate id, role, isApproved
- Middleware: protects /recipes, /planner (auth required), /admin (ADMIN role required)
- POST /api/auth/register — zod validation, duplicate email guard, bcrypt saltRounds=12
- Login, Register, Pending approval pages with Japandi styling
- SidebarLayout: desktop fixed sidebar + mobile bottom nav
- Dashboard page (stat card placeholders)
- GET + PATCH /api/admin/users — list and approve/reject users
- Admin users page at /admin/users
- prisma/seed.ts — idempotent admin user seed (tsx runner)
- Directory structure, AGENTS.md, CLAUDE.md, docs/, plans/ scaffolded

---
_Versions start at 0.1.0 (local dev). 1.0.0 = first production deploy._
