# API Contracts

All API routes documented here. Update after adding or changing routes.

Format: METHOD /path — description
Auth: public | user (session + isApproved) | admin (session + role=ADMIN)

## Auth
- POST /api/auth/register — create user (isApproved=false) — public
- POST /api/auth/signin — Auth.js credentials login — public
- POST /api/auth/signout — logout — user

## Recipes
- GET /api/recipes — list recipes, ?category=BREAKFAST|LUNCH|DINNER filter — user
- POST /api/recipes — create recipe — user
- GET /api/recipes/[id] — get recipe detail — user
- PATCH /api/recipes/[id] — update recipe — user (own) | admin
- DELETE /api/recipes/[id] — delete recipe — user (own) | admin

## Meal Plans
- GET /api/meal-plans?from=&until= — list user's meal plans in date range — user
- POST /api/meal-plans — assign recipe to slot — user
- PATCH /api/meal-plans/[id] — update slot — user (own)
- DELETE /api/meal-plans/[id] — clear slot — user (own)

## Admin
- GET /api/admin/users — list all users — admin
- GET /api/admin/users?status=pending — list unapproved users — admin
- PATCH /api/admin/users/[id]/approve — approve user — admin
- PATCH /api/admin/users/[id]/reject — reject/deactivate user — admin

## Uploads
- POST /api/uploads — upload food photo, returns { url: "/uploads/<uuid>.<ext>" } — user
  - Accept: image/jpeg, image/png, image/webp
  - Max: 5MB

## Response shape (all routes)
```json
// success
{ "data": <payload> }

// error
{ "error": "message" }
```
