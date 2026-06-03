# progress.md — Live Task Tracker

Last updated: 2026-06-03

## Current Phase: 0 — Pre-build (scaffolding complete)

## Phase 1 — Scaffold + Auth
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Next.js project init | pending | SYSOPS | `npx create-next-app@latest` |
| Tailwind + shadcn/ui setup | pending | FRONTEND | |
| Prisma schema + migration | pending | DBA | User, Recipe, MealPlan models |
| Auth.js v5 credentials provider | pending | BACKEND | isApproved gate |
| Register page + API | pending | FRONTEND+BACKEND | |
| Login page + API | pending | FRONTEND+BACKEND | isApproved check |
| Middleware (route protection) | pending | BACKEND | |
| Admin approval dashboard | pending | FRONTEND+BACKEND | list pending users, approve/reject |
| SidebarLayout component | pending | FRONTEND | desktop sidebar + mobile bottom nav |
| Auth tests | pending | QA | |
| Auth security review | pending | SECURITY | |

## Phase 2 — Recipe Engine
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Recipe CRUD API | pending | BACKEND | |
| Recipe list page + filters | pending | FRONTEND | breakfast/lunch/dinner tabs |
| Recipe detail page | pending | FRONTEND | steps, photo |
| Photo upload handler | pending | BACKEND | MIME validate, max 5MB, uuid filename |
| Add/edit recipe form | pending | FRONTEND | |
| Recipe tests | pending | QA | |

## Phase 3 — Meal Planner
| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| MealPlan CRUD API | pending | BACKEND | |
| FullCalendar weekly view | pending | FRONTEND | |
| Slot assignment + recipe picker modal | pending | FRONTEND | |
| Planner tests | pending | QA | |

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
_Nothing yet._

## Blocked
_Nothing._
