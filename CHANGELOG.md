# CHANGELOG.md

All notable changes to this project documented here.
Format: [version] [date] — [description]

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
