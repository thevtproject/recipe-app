# Architecture

## Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | Next.js 14 App Router + TypeScript | Monorepo (frontend + API in one repo) |
| Database | PostgreSQL 16 | Production-grade, Prisma support |
| ORM | Prisma 5 | Type-safe queries, migrations |
| Auth | Auth.js v5 (NextAuth beta) credentials | Local DB auth, JWT session, isApproved gate |
| UI | Tailwind + shadcn/ui | Japandi theme via CSS vars |
| Calendar | Custom weekly grid (FullCalendar dropped) | Multi-recipe slots needed custom layout |
| Image processing | sharp + libvips | 1920px WebP for recipes, 512px for avatars |
| Storage | Local filesystem `public/uploads/` | Single-server MVP; swap for S3/R2 later |
| Deploy | Docker Compose + Nginx + Cloudflare Tunnel | CGNAT-friendly, no port forwarding |
| TLS | Cloudflare (terminated at edge) | No DNS-01 cert dance with dynamic IP |

## Domain Model

```prisma
model User {
  id           String       @id @default(cuid())
  email        String       @unique
  password     String       // bcrypt, saltRounds=12
  name         String
  role         Role         @default(USER)
  isApproved   Boolean      @default(false)
  householdId  String?      // Phase 6: family grouping
  avatarUrl    String?
  createdAt    DateTime     @default(now())
  recipes      Recipe[]
  mealPlans    MealPlan[]
  ratings      Rating[]
  cookedLogs   CookedHistory[]
  household    Household?   @relation(fields: [householdId], references: [id])
}

model Household {
  id          String   @id @default(cuid())
  name        String
  inviteCode  String   @unique  // 8-char base62
  createdAt   DateTime @default(now())
  members     User[]
  mealPlans   MealPlan[]
  shoppingLists ShoppingList[]
}

model Recipe {
  id            String       @id @default(cuid())
  title         String
  description   String?
  categories    Category[]   // multi-value (Postgres array)
  photoUrl      String?
  servings      Int          @default(4)
  prepTimeMin   Int?
  cookTimeMin   Int?
  ingredients   Json         // [{quantity:number, unit:string, item:string}]
  steps         Json         // [{order:number, instruction:string}]
  ratingAvg     Float        @default(0)  // denormalized
  ratingCount   Int          @default(0)  // denormalized
  lastCookedAt  DateTime?
  authorId      String
  author        User         @relation(fields: [authorId], references: [id])
  createdAt     DateTime     @default(now())
  ratings       Rating[]
  cookedHistory CookedHistory[]
}

model MealPlan {
  id           String    @id @default(cuid())
  userId       String    // creator
  user         User      @relation(fields: [userId], references: [id])
  householdId  String?   // Phase 6: family-scope plan
  date         DateTime
  mealType     MealType
  recipeId     String
  recipe       Recipe    @relation(fields: [recipeId], references: [id])
  // No @@unique on (userId,date,mealType) — multiple recipes per slot allowed
}

model Rating {
  id        String   @id @default(cuid())
  userId    String
  recipeId  String
  stars     Int      // 1..5
  comment   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  recipe    Recipe   @relation(fields: [recipeId], references: [id])
  @@unique([userId, recipeId])
}

model CookedHistory {
  id       String   @id @default(cuid())
  userId   String
  recipeId String
  cookedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id])
  recipe   Recipe   @relation(fields: [recipeId], references: [id])
}

model ShoppingList {
  id           String   @id @default(cuid())
  ownerUserId  String?  // for "ME" scope
  householdId  String?  // for "FAMILY" scope
  weekStart    DateTime
  weekEnd      DateTime
  items        Json     // [{name, quantity, unit, category, checked}]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  household    Household? @relation(fields: [householdId], references: [id])
}

model PlanShare {
  token     String   @id @default(cuid())
  scope     String   // "ME" | "FAMILY"
  refId     String   // "<scopeId>|<from>|<until>" (window packed)
  createdBy String
  expiresAt DateTime?
  createdAt DateTime @default(now())
}

enum Role     { USER ADMIN }
enum Category { BREAKFAST LUNCH DINNER }
enum MealType { BREAKFAST LUNCH DINNER }
```

## Service Topology

```
                  HTTPS (Cloudflare edge)
                          │
                  ┌───────▼────────┐
                  │  cloudflared   │  (outbound tunnel — no inbound port)
                  └───────┬────────┘
                          │ 127.0.0.1:80
                  ┌───────▼────────┐
                  │     nginx      │  (static + reverse proxy, HTTP only)
                  └───────┬────────┘
                          │ app:3000
                  ┌───────▼────────┐
                  │  Next.js app   │  (non-root, NextAuth v5, Prisma)
                  └───────┬────────┘
                          │ postgres16:5432
                  ┌───────▼────────┐
                  │   PostgreSQL   │  (on internal Docker network only)
                  └────────────────┘
```

The `internal` Docker network has no host port mapping. Only nginx publishes
80 to host loopback. Cloudflare Tunnel connects outbound to the edge. The DB
is never reachable from outside the Docker network.

## Auth Flow

1. `POST /api/auth/register` — zod validation, bcrypt hash, isApproved=false
2. Admin `PATCH /api/admin/users/[id]/approve` — isApproved=true
3. `POST /api/auth/callback/credentials` — bcrypt verify + isApproved gate
4. JWT signed with NEXTAUTH_SECRET (HS256); 30-day expiry
5. Session callback exposes `id, role, isApproved, householdId` to server
6. `middleware.ts` (edge-safe auth.config.ts) blocks unauth'd access to
   `/dashboard`, `/recipes`, `/planner`, `/shopping-list`, `/household`,
   `/admin/*`. `/planner/share/[token]` is public (token-gated).
7. `/admin/*` additionally requires `role=ADMIN`

## Request Lifecycle (typical page)

1. Browser → Cloudflare edge (TLS, WAF, DDoS) → tunnel → nginx → Next.js
2. `middleware.ts` runs first (edge runtime) — checks JWT, may 307 redirect
3. Server component runs (Node runtime) — fetches session, queries Prisma
4. Client component hydrates for interactive widgets (picker, forms)
5. Mutations go to `/api/*` route handlers (Node runtime, full Prisma)

## Edge vs Node Split

- `auth.config.ts` — edge-safe (no Prisma, no bcrypt, no Node imports)
- `lib/auth.ts` — full NextAuth with Prisma adapter, bcrypt — Node only
- `middleware.ts` imports `authConfig` (edge-safe)
- API route handlers import `auth` from `lib/auth` (Node, full session)
- Prisma client is generated for `linux-musl-openssl-3.0.x` (Alpine runtime)

## Phase 6 Features at a Glance

| Feature | Storage | Endpoint(s) | UI |
|---------|---------|-------------|-----|
| Recipe scaling | URL `?servings=N` | (read-only) | RecipeIngredients |
| Ratings | `Rating` table | `POST/DELETE /api/ratings` | RatingWidget |
| Cooked-this | `CookedHistory` | `POST /api/cooked` | CookedButton |
| Multi-recipe slot | (removed unique) | `POST /api/meal-plans` | WeeklyPlanner |
| Multi-category | Postgres `Category[]` | `POST/PUT /api/recipes` | RecipeForm toggle |
| Shopping list | `ShoppingList` (client-cached) | `GET /api/shopping-list` | /shopping-list page |
| Planner print | (URL only) | (none) | /planner/print |
| Planner WhatsApp | (URL only) | (none) | wa.me deeplink |
| Planner share link | `PlanShare` table | `POST /api/meal-plans/share` | /planner/share/[token] |
| Households | `Household` table | `/api/households{,/me,/join,/leave}` | /household page |

## Deploy Path (rebuild)

```
cd /home/andryan/recipe-app
docker compose build app        # rebuild image
docker compose up -d app         # restart container
docker compose logs -f app       # watch startup
```

DB migrations: `docker compose run --rm app npx prisma migrate deploy` (run
as `root` because the app process is `nextjs` non-root).

## Known Constraints / Tradeoffs

- **No real-time sync** — planner is fetch-on-mount. Multi-user editing on
  the same slot is "last write wins". Acceptable for a 3-person family.
- **Session JWT has no rotation** — stolen cookie lives for 30 days. Mitigated
  by Cloudflare WAF + the fact that everything is on one network.
- **DB bind to Docker internal network** — relies on `internal` Docker
  network isolation, not on PostgreSQL HBA. If host firewall is open and a
  process escapes, the DB is reachable. This is acceptable for a private
  family app, not for multi-tenant SaaS.
- **File uploads go to a Docker volume** — survives `docker compose up -d`
  but not `docker volume rm`. Backups should `cp` the volume.
