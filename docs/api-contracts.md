# API Contracts

All API routes documented here. Update after adding or changing routes.

Format: `METHOD /path` — description
Auth: `public` | `user` (session + isApproved) | `admin` (session + role=ADMIN)

All routes return: `{ "data": <payload> | null, "error": string | null }`
Auth failures return HTTP 401 with `{ "error": "Unauthorized" }`.

## Auth
- `POST /api/auth/register` — `{ email, password, name }` — public
- `POST /api/auth/callback/credentials` — Auth.js login — public
- `POST /api/auth/signout` — logout — user

## Recipes
- `GET  /api/recipes` — list, `?category=BREAKFAST,LUNCH` (OR), `?householdId=` — user
- `POST /api/recipes` — `{ title, description?, categories[], photoUrl?, servings?, prepTimeMin?, cookTimeMin?, ingredients[], steps[] }` — user
- `GET  /api/recipes/[id]` — detail with ratings — user
- `PATCH /api/recipes/[id]` — update (owner or admin) — user/admin
- `DELETE /api/recipes/[id]` — delete (owner or admin) — user/admin

## Uploads
- `POST /api/uploads` — multipart `file` field — user
  - Accept: image/jpeg, image/png, image/webp (magic bytes validated)
  - Max: 5MB; auto-compressed to 1920px WebP q82 via sharp
  - Returns: `{ data: { url: "/uploads/<uuid>.webp" }, error: null }`

## Meal Plans
- `GET  /api/meal-plans?from=YYYY-MM-DD&until=YYYY-MM-DD&scope=ME|FAMILY`
- `POST /api/meal-plans` — `{ date, mealType, recipeId, scope? }` — user
- `DELETE /api/meal-plans/[id]` — owner or admin — user/admin
- `POST /api/meal-plans/share` — `{ from, until, scope, ttlDays? }` — user
  - Returns: `{ data: { token, url: "/planner/share/<token>", expiresAt } }`

## Ratings
- `GET  /api/ratings?recipeId=` — list ratings — user
- `POST /api/ratings` — `{ recipeId, stars, comment? }` (1..5) — user
- `DELETE /api/ratings?recipeId=` — remove own rating — user
- Triggers `Recipe.ratingAvg` and `Recipe.ratingCount` recompute

## Cooked-this
- `POST /api/cooked` — `{ recipeId }` — user
- `GET  /api/cooked?limit=50` — recent history — user
- `GET  /api/cooked/streak` — cook streak stats — user — returns `{ currentStreak, longestStreak, totalCooks, lastCookedAt, todayCookCount }`
- Side effect: updates `Recipe.lastCookedAt`

## Households
- `GET  /api/households/me` — current household + members — user
- `POST /api/households` — `{ name }` — create (user joins) — user
- `POST /api/households/join` — `{ inviteCode }` — user
- `POST /api/households/leave` — disconnect self — user

## Shopping List
- `GET /api/shopping-list?from=&until=&scope=ME|FAMILY`
  - Aggregates `ingredients` from all recipes in user's/family's plans for the date range
  - Groups by category (produce/dairy/meat/pantry/spices/other)
  - Returns: `{ data: { categories: {<cat>: [{name, quantity, unit, recipeTitle, mealType, date}] }, totalItems, totalRecipes, from, until, scope } }`

## Profile
- `PATCH /api/profile` — `{ name?, avatarUrl? }` — user
- `POST /api/profile/password` — `{ currentPassword, newPassword }` — user
- `POST /api/profile/avatar` — multipart `file` — user (sharp 512px WebP q85)

## Admin
- `GET  /api/admin/users?status=pending|approved|all` — admin
- `PATCH /api/admin/users` — `{ userId, action: 'approve' | 'reject' }` — admin
- `GET  /api/admin/ratings?limit=&recipeId=&userId=&q=` — admin
  - `q` matches recipe title, user name, or comment (case-insensitive substring)
  - Returns ratings with `user { id, name, email, avatarUrl }` and `recipe { id, title, photoUrl, categories }`
- `DELETE /api/admin/ratings` — `{ id }` — admin — hard delete + recompute `Recipe.ratingAvg/ratingCount`
- `GET  /api/admin/cooked-history?limit=&recipeId=&userId=&q=&from=&to=` — admin
  - `q` matches recipe title, user name, or email
  - `from`/`to` are local-day boundaries (YYYY-MM-DD)
  - Returns entries with `user { id, name, email, avatarUrl }` and `recipe { id, title, photoUrl, categories }`
- `DELETE /api/admin/cooked-history` — `{ id }` — admin — hard delete + recompute `Recipe.lastCookedAt` only if the deleted cook was the most recent

## Admin UI
- `/admin/users` — approve/reject pending registrations (existing)
- `/admin/activity` — Reviews + Cooked history tabs with search, filters, and per-row delete (admin sub-nav: Users | Activity)

## Planner (UI-only routes, not API)
- `GET /planner/print?from=&until=` — server-rendered HTML, auto-triggers print dialog
- `GET /planner/share/[token]` — public read-only weekly view (token-gated, 30-day TTL)

## Validation

All POST/PATCH bodies validated with zod. Validation failures return HTTP 400
with `{ "error": "Invalid input", "issues": {...} }`.
