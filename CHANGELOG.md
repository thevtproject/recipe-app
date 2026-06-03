# CHANGELOG.md

All notable changes to this project documented here.
Format: [version] [date] — [description]

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
