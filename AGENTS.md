# AGENTS.md — Recipe App Master Context

Universal AI context file. Read this first. Every AI tool (Hermes, Claude Code, Gemini, Cursor, Codex) reads this to get oriented.

## What This Is
Private family recipe webapp. Closed user system (admin approval required). Weekly meal planner per user.

## Goals
1. Recipe library — breakfast/lunch/dinner filter, food photos, step-by-step instructions
2. Closed user system — register → admin approval → login
3. Weekly meal planner — calendar UI, select or add recipes per meal slot
4. Let's Encrypt TLS via owned domain (DNS-01 challenge, local-first)

## Current Phase
See progress.md for live status.

## Stack (locked — do not change without discussion)
- Next.js 14 App Router, TypeScript strict mode
- PostgreSQL + Prisma ORM
- Auth.js v5 (NextAuth) — credentials provider
- Tailwind CSS + shadcn/ui
- FullCalendar — weekly meal planner
- Docker Compose + Nginx + Certbot (DNS-01)
- Code root: /home/andryan/recipe-app/

## Directory Structure
```
recipe-app/
├── app/
│   ├── (auth)/           # login, register pages
│   ├── (app)/            # recipes, planner, admin (auth-gated)
│   └── api/              # API routes
│       ├── auth/
│       ├── recipes/
│       ├── meal-plans/
│       └── admin/users/
├── components/
│   ├── ui/               # shadcn/ui generated — do not modify
│   ├── recipe/
│   ├── planner/
│   └── admin/
├── lib/
│   ├── auth.ts           # Auth.js config
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/uploads/       # user-uploaded food photos
├── nginx/default.conf
├── docker-compose.yml
├── .env                  # never commit
├── AGENTS.md             # this file
├── CLAUDE.md             # Claude Code specific
├── progress.md           # live task tracker
├── CHANGELOG.md          # ship log
└── docs/
    ├── architecture.md   # stack decisions, schema, auth flow
    ├── design-system.md  # color tokens, components, aesthetic
    └── api-contracts.md  # all API routes
```

## Key DB Models
```
User:     id, email, password(bcrypt), name, role(USER|ADMIN), isApproved(bool), createdAt
Recipe:   id, title, description, category(BREAKFAST|LUNCH|DINNER), photoUrl, steps(JSON), authorId, createdAt
MealPlan: id, userId, date, mealType(BREAKFAST|LUNCH|DINNER), recipeId
```

## Auth Flow
1. Register → isApproved=false, role=USER
2. Admin approves user → isApproved=true
3. Login: valid credentials AND isApproved=true required, else reject with reason
4. Middleware gates all /app/* routes: session + isApproved check
5. /admin/* routes: session + role=ADMIN check

## Conventions
- Read files before editing — never overwrite blind
- Match existing code style — no new libraries without flagging
- All API responses: { data, error } shape
- Passwords: bcrypt saltRounds=12, never log or return
- Photos: stored as /uploads/<uuid>.<ext>, MIME validated server-side (jpeg/png/webp), max 5MB
- .env vars: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, UPLOAD_DIR
- Never hardcode secrets
- Run `npx tsc --noEmit` after changes — fix all type errors before done
- Tests must pass before any task is marked done

## Build Phases
- Phase 1 — Scaffold + Auth: Next.js skeleton, Prisma schema, auth, isApproved gate, admin approval
- Phase 2 — Recipe Engine: CRUD, category filter, photo upload, step display
- Phase 3 — Meal Planner: FullCalendar weekly view, slot assignment, recipe picker modal
- Phase 4 — SysOps: Docker Compose, Nginx, Certbot DNS-01, production hardening

## Design System (Warm Kitchen / Editorial)
- Light bg: warm off-white (slate-50 / amber-50/10)
- Dark bg: deep charcoal/slate — class-based dark mode
- Accent: terracotta/amber (warm) or emerald/olive (fresh) — TBD before Phase 1
- Layout: SidebarLayout — desktop sidebar / mobile bottom nav
- Nav links: Dashboard, Recipe Book, Weekly Planner, Admin Panel (isAdmin only)
- shadcn/ui: Card, Dialog, Button, DropdownMenu, Avatar

## Docs
- Architecture decisions → docs/architecture.md
- API routes → docs/api-contracts.md
- Design tokens → docs/design-system.md
- Live progress → progress.md
- Ship log → CHANGELOG.md

## For AI Tools
- After adding API routes: update docs/api-contracts.md
- After schema changes: update docs/architecture.md
- After shipping a feature: add entry to CHANGELOG.md + update progress.md
- AGENTS.md and CLAUDE.md must stay in sync
