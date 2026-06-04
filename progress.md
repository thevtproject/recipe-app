# progress.md — Live Task Tracker

Last updated: 2026-06-04

## Current Phase: 4 — SysOps

## Phase 1 — Scaffold + Auth ✅ DONE (2026-06-04)
| Task | Status | Notes |
|------|--------|-------|
| Next.js project init | ✅ done | Next.js 14.2.35, TypeScript strict |
| Tailwind + shadcn/ui setup | ✅ done | Japandi tokens, oklch CSS vars |
| Prisma schema + migration | ✅ done | User, Recipe, MealPlan — migration pending DB |
| Auth.js v5 credentials provider | ✅ done | isApproved gate, JWT callbacks |
| Register page + API | ✅ done | zod validation, bcrypt saltRounds=12 |
| Login page + API | ✅ done | isApproved check, /pending redirect |
| Middleware (route protection) | ✅ done | gates /recipes, /planner, /admin |
| Admin approval dashboard | ✅ done | GET/PATCH /api/admin/users |
| SidebarLayout component | ✅ done | desktop sidebar + mobile bottom nav |
| Seed admin user | ✅ done | prisma/seed.ts, tsx runner |
| Auth tests | pending | QA |
| Auth security review | pending | SECURITY |

## Phase 2 — Recipe Engine ✅ DONE (2026-06-04)
| Task | Status | Notes |
|------|--------|-------|
| Recipe CRUD API | ✅ done | GET/POST /api/recipes, GET/PATCH/DELETE /api/recipes/[id] |
| Photo upload API | ✅ done | magic byte validation, 5MB limit, uuid filename |
| Recipe list page | ✅ done | category filter tabs, responsive card grid, skeleton |
| Recipe detail page | ✅ done | photo, steps, owner edit link |
| Add recipe page | ✅ done | /recipes/new |
| Edit recipe page | ✅ done | /recipes/[id]/edit, owner+admin gate |

## Phase 3 — Meal Planner ✅ DONE (2026-06-04)
| Task | Status | Notes |
|------|--------|-------|
| FullCalendar v6 install | ✅ done | @fullcalendar/react,daygrid,timegrid,interaction |
| MealPlan API | ✅ done | GET/POST /api/meal-plans, DELETE /api/meal-plans/[id] |
| RecipePicker dialog | ✅ done | searchable, filtered by mealType |
| Weekly planner page | ✅ done | timeGridWeek, click-to-add, trash-to-remove |

## Phase 4 — SysOps
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Dockerfile (multi-stage) | pending | SYSOPS | |
| docker-compose.yml | pending | SYSOPS | app + db + nginx + certbot |
| Nginx reverse proxy config | pending | SYSOPS | |
| Certbot DNS-01 TLS | pending | SYSOPS | no port 80/443 required |
| .env.example | pending | SYSOPS | |
| Production hardening | pending | SECURITY | |

## Completed
- Phase 1 — Scaffold + Auth (2026-06-04)
- Phase 2 — Recipe Engine (2026-06-04)
- Phase 3 — Meal Planner (2026-06-04)

## Blocked
_None._
