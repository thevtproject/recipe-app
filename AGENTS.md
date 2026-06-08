# AGENTS.md — Recipe App Master Context

Universal AI context file. Read this first. Every AI tool (Hermes, Claude Code,
Gemini, Cursor, Codex) reads this to get oriented.

## What This Is
Private family recipe webapp. Closed user system (admin approval required).
Weekly meal planner per user (or per household).

**Live at:** https://<your-domain>
**Repo:** <repo-root>
**Server:** `<server-hostname>` (LAN <server-ip>, behind CGNAT)

## Goals
1. Recipe library — multi-category filter, food photos, step-by-step
2. Closed user system — register → admin approval → login
3. Weekly meal planner — multi-recipe per slot, print/share/WhatsApp
4. Public HTTPS via Cloudflare Tunnel (no port forwarding)
5. Households — family-scoped meal plans

## Stack (locked)
- **Framework:** Next.js 14 App Router + TypeScript strict
- **Database:** PostgreSQL 16 + Prisma 5 (binary: linux-musl-openssl-3.0.x)
- **Auth:** Auth.js v5 (next-auth@beta) credentials, JWT, isApproved gate
- **UI:** Tailwind + shadcn/ui (Japandi theme — warm beige + sand accent)
- **Image processing:** sharp + libvips (1920px WebP recipes, 512px avatars)
- **Deploy:** Docker Compose + Nginx + Cloudflare Tunnel

## Directory Structure
```
recipe-app/
├── app/
│   ├── (auth)/            login, register, pending-approval
│   ├── (app)/             dashboard, recipes, planner, shopping-list, household, profile, admin
│   ├── planner/           print + share/[token] (public token-gated view)
│   ├── api/               recipes, meal-plans, ratings, cooked, households, shopping-list,
│   │                      admin/users, auth, profile, uploads
│   └── ...
├── components/
│   ├── ui/                shadcn-generated (button, input, dialog, etc.)
│   ├── recipe/            RecipeForm, RecipeIngredients, RatingWidget, CookedButton
│   ├── planner/           WeeklyPlanner, RecipePicker, PrintView
│   ├── layout/            SidebarNav, BottomNav
│   └── admin/
├── lib/
│   ├── auth.ts            full NextAuth (Node)
│   ├── auth.config.ts     edge-safe (no Prisma, no bcrypt)
│   ├── prisma.ts          singleton
│   ├── images.ts          sharp compress (recipe + avatar)
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/        versioned
├── types/
│   └── next-auth.d.ts     module augmentation for session
├── public/uploads/        recipe photos + avatars (Docker volume)
├── nginx/default.conf     HTTP-only, proxies to app:3000
├── docker-compose.yml     app, db, nginx, cloudflared
├── Dockerfile             multi-stage with vips
├── middleware.ts          edge-safe auth gate
├── .env                   DB + NEXTAUTH_SECRET + NEXTAUTH_URL
└── docs/
    ├── architecture.md    stack, schema, service topology
    ├── api-contracts.md   all API routes
    ├── design-system.md   color tokens, components
    ├── DEPLOY.md          server setup, tunnel, deploy commands
    └── plans/             per-phase implementation plans
```

## Key DB Models (Prisma)
- **User** — id, email, password(bcrypt), name, role(USER|ADMIN), isApproved(bool),
  householdId?, avatarUrl?, createdAt
- **Household** — id, name, inviteCode(unique 8-char), members[]
- **Recipe** — id, title, description, categories[Category] (Postgres array),
  photoUrl, servings, prepTimeMin, cookTimeMin, ingredients(Json), steps(Json),
  ratingAvg, ratingCount, lastCookedAt, authorId
- **MealPlan** — id, userId, householdId?, date, mealType, recipeId
  (NO unique constraint — multiple recipes per slot allowed)
- **Rating** — id, userId, recipeId, stars(1-5), comment? — @@unique([userId, recipeId])
- **CookedHistory** — id, userId, recipeId, cookedAt
- **ShoppingList** — id, ownerUserId?, householdId?, weekStart, weekEnd, items(Json)
- **PlanShare** — id, token, scope(ME|FAMILY), refId(packed), createdBy, expiresAt

## Auth Flow
1. `POST /api/auth/register` → User with `isApproved=false`
2. Admin `PATCH /api/admin/users` → `isApproved=true`
3. `POST /api/auth/callback/credentials` → bcrypt verify + isApproved gate
4. JWT (HS256, NEXTAUTH_SECRET) carries `id, role, isApproved, householdId`
5. `middleware.ts` (edge-safe `auth.config.ts`) gates `/(app)/*` and `/admin/*`
6. `/planner/share/[token]` is public (token-gated, 30-day TTL)
7. `/admin/*` additionally requires `role=ADMIN`

## Conventions
- **Read files before editing** — never overwrite blind
- Match existing code style — flag new deps before adding
- All API responses: `{ data, error }` shape
- Passwords: bcrypt saltRounds=12, never log or return
- Photos: `/uploads/<uuid>.<ext>` and `/uploads/avatars/<uuid>.<ext>`, MIME magic-byte validated
- File size limit: 6MB nginx, 5MB app (sharp auto-compresses to WebP)
- `npx tsc --noEmit` clean before declaring done
- `.env` never committed; `SEED_ADMIN_PASSWORD` defaults to a strong value
- `auth.config.ts` is edge-safe — no Prisma, no bcrypt, no Node-only modules
- `lib/auth.ts` is full server — uses Prisma adapter, bcrypt

## Build Phases (all complete)
- Phase 1 — Scaffold + Auth (2026-06-04)
- Phase 2 — Recipe Engine (2026-06-04)
- Phase 3 — Meal Planner (2026-06-04)
- Phase 4 — SysOps / Deployment (2026-06-04)
- Phase 5 — Post-Launch Polish (2026-06-04)
- Phase 6 — Family Features & UX (2026-06-04)

## Design System (Japandi)
- Light bg: `#F5F0EB` (warm beige)
- Accent: `#A8956A` (warm sand)
- Text: stone-800, border `#D6CEC4`
- CSS vars in `app/globals.css`, consumed via shadcn CSS var pattern

## Security Hardening (current state)
- ✅ Auth.js JWT (HS256, NEXTAUTH_SECRET, 30-day expiry)
- ✅ bcrypt saltRounds=12
- ✅ zod validation on all POST/PATCH bodies
- ✅ IDOR checks on Recipe PATCH/DELETE (owner or admin only)
- ✅ Magic-byte file-type validation (not just MIME)
- ✅ Cloudflare WAF + DDoS protection
- ✅ Cloudflare Tunnel (no inbound port)
- ✅ PostgreSQL on internal Docker network (no host port)
- ✅ Rate limit on `/api/auth/register`: ⚠️ not implemented — see todo
- ✅ CSRF: NextAuth built-in
- ✅ HSTS: Cloudflare edge adds it externally
- ✅ CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy: nginx

## For AI Tools
- After adding API routes: update `docs/api-contracts.md`
- After schema changes: update `docs/architecture.md`
- After shipping: add `CHANGELOG.md` entry + update `progress.md`
- AGENTS.md must stay in sync with reality
