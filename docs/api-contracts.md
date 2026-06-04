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
- POST /api/recipes — create recipe { title, description?, category, photoUrl?, steps } — user
- GET /api/recipes/[id] — get recipe detail — user
- PATCH /api/recipes/[id] — update recipe (owner or admin) — user
- DELETE /api/recipes/[id] — delete recipe (owner or admin) — user

## Uploads
- POST /api/uploads — upload food photo (multipart field: file) — user
  - Accept: image/jpeg, image/png, image/webp (magic byte validated)
  - Max: 5MB
  - Returns: { data: { url: "/uploads/<uuid>.<ext>" }, error: null }

## Response shape (all routes)
```json
// success
{ "data": <payload> }

// error
{ "error": "message" }
```
