# AI Recipe Import + Intelligent Shopping List

**Goal:** Add AI-powered recipe import from URL and upgrade shopping list with persistence, household sync, and smarter categorization.

**Branch:** `feature/ai-import-shopping-list`

**Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, cheerio (HTML), OpenAI SDK (AI fallback)

---

## Feature A: AI Recipe Import from URL

**Approach:** Paste a URL → backend fetches HTML → extracts JSON-LD (schema.org/Recipe) from most sites → fallback to meta tag extraction → pre-fills RecipeForm. No API key needed for basic extraction (JSON-LD covers AllRecipes, Cookpad, Food Network, etc.). If `OPENAI_API_KEY` is set, use LLM for harder sites.

### Task A1: Add dependencies + Recipe schema migration

**Files:**
- Modify: `prisma/schema.prisma` — add `sourceUrl String?` to Recipe
- Modify: `package.json` — add `cheerio` and `openai`

**Step 1:** Add `sourceUrl` field to Recipe model:
```prisma
model Recipe {
  // ... existing fields
  sourceUrl   String?
  // ...
}
```

**Step 2:** Install deps:
```bash
npm install cheerio openai
```

**Step 3:** Generate migration:
```bash
npx prisma migrate dev --name add-source-url
```

### Task A2: Create recipe import API route

**Files:**
- Create: `app/api/recipes/import-url/route.ts`
- Create: `lib/recipe-import.ts` (extraction logic)

**`lib/recipe-import.ts`** — Core extraction:
1. Fetch HTML from URL (with normal User-Agent to avoid CF blocks)
2. Parse with cheerio
3. Look for `<script type="application/ld+json">` containing `@type: "Recipe"`
4. Parse JSON-LD → extract title, description, image, ingredients[], steps[], prepTime, cookTime, servings
5. Fallback to og:title, og:image, meta description
6. If OPENAI_API_KEY set + JSON-LD empty, use OpenAI gpt-4o-mini to extract from raw HTML text
7. Map to Recipe create shape: `{ title, description, ingredients, steps, prepTimeMin, cookTimeMin, servings, photoUrl?, sourceUrl }`

**`app/api/recipes/import-url/route.ts`:**
- POST handler: `{ url }` → validate with zod → call extract → return `{ data: PartialRecipe }`
- Response shape matches what RecipeForm can consume
- Error handling: network failure, not a recipe page, rate limiting

### Task A3: Create import URL UI component

**Files:**
- Create: `components/recipe/RecipeImportDialog.tsx`
- Modify: `app/(app)/recipes/new/page.tsx` — add import button/option

**`RecipeImportDialog.tsx`:**
- "Import from URL" button (opens dialog)
- URL input field + "Import" button
- Loading state during fetch + extraction
- On success: navigate to `/recipes/new?import=<base64-encoded-data>` or call parent callback with pre-fill data
- Error display for invalid URL, network error, not a recipe

**`app/(app)/recipes/new/page.tsx`:**
- Accept optional `?url=` search param
- Show "Import from URL" button above the form
- Pass imported data to RecipeForm as `initialData` prop

### Task A4: Update RecipeForm to accept initial data

**Files:**
- Modify: `components/recipe/RecipeForm.tsx` — accept `initialData` prop and pre-fill fields

**Changes:**
- Add `initialData?: Partial<RecipeFormData>` prop
- If provided, populate all form fields (title, description, servings, time, categories, ingredients, steps, photo)
- This allows the import dialog to hand off data without a server round-trip

---

## Feature B: Intelligent Shopping List

**Approach:** Persist check state to DB, add manual items, smarter categorization, household sync. No new ShoppingList model — checks are stored separately and merged with computed list on load.

### Task B1: Add ShoppingListCheck + ManualItem models

**Files:**
- Modify: `prisma/schema.prisma`

New models:
```prisma
model ShoppingListCheck {
  id          String   @id @default(cuid())
  householdId String?
  weekStart   DateTime @db.Date
  itemKey     String   // hash of normalized "name|unit"
  checked     Boolean  @default(true)
  checkedBy   String   // userId
  checkedAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([householdId, weekStart, itemKey])
  @@index([householdId, weekStart])
  @@map("shopping_list_checks")
}

model ShoppingListItem {
  id          String   @id @default(cuid())
  householdId String?
  userId      String
  weekStart   DateTime @db.Date
  name        String
  category    String   @default("other")
  amount      String?
  unit        String?
  recipeId    String?  // null if manually added
  createdAt   DateTime @default(now())

  @@index([householdId, weekStart])
  @@map("shopping_list_items")
}
```

### Task B2: Expand aisle categorization keywords

**Files:**
- Modify: `app/api/shopping-list/route.ts`

Expand `CATEGORY_KEYWORDS` with more items and subcategories:
- More produce items (Asian greens, herbs, tropical fruit)
- More pantry (canned goods, condiments, noodles types)
- More spices/seasonings
- Better handling of compound names

### Task B3: New API routes for shopping list operations

**Files:**
- Create: `app/api/shopping-list/check/route.ts` — POST (toggle check), GET (get checks for a week)
- Create: `app/api/shopping-list/items/route.ts` — POST (manual add), DELETE (remove)

**`POST /api/shopping-list/check`:**
```json
{ "itemKey": "chicken thigh|", "weekStart": "2026-06-15", "checked": true, "scope": "FAMILY" }
```
- Upsert check record
- If scope=FAMILY and user has household, the check applies to all household members

**`GET /api/shopping-list/check?weekStart=...&scope=...`:**
- Returns all checked items for the week
- Merged across household members

**`POST /api/shopping-list/items`:**
```json
{ "name": "baguette", "category": "pantry", "amount": "1", "unit": "loaf", "weekStart": "2026-06-15" }
```
- Add a manual item to the shopping list

**`DELETE /api/shopping-list/items/[id]`:**
- Remove a manual item (owner only)

### Task B4: Update shopping list page with sync

**Files:**
- Modify: `app/(app)/shopping-list/page.tsx`

Changes:
1. On load, fetch checks from `/api/shopping-list/check`
2. Toggle check → POST to `/api/shopping-list/check` (optimistic UI)
3. Show checked items with who checked them (family scope)
4. Add "Add item" button → inline form or dialog
5. Manual items appear at top of their category with a delete button
6. Poll checks every 15 seconds when in FAMILY scope (simple polling, no WebSocket)

### Task B5: Smart merge improvements

**Files:**
- Modify: `app/api/shopping-list/route.ts`

Current: merges by lowercase name. Enhance:
- Normalize plurals (onion → onions, berry → berries)
- Merge "red bell pepper" with "bell pepper" (keyword overlap)
- Preserve the most common display name
- Better unit display (combine "2 tbsp" + "1 tsp" → "2 tbsp + 1 tsp" or try preferred unit)

---

## Tasks Summary

| Task | Feature | Files | Est. |
|------|---------|-------|------|
| A1 | Deps + schema | `schema.prisma`, `package.json` | 10min |
| A2 | Import API | `api/recipes/import-url/`, `lib/recipe-import.ts` | 20min |
| A3 | Import dialog | `RecipeImportDialog.tsx`, `recipes/new/page.tsx` | 15min |
| A4 | Form pre-fill | `RecipeForm.tsx` | 10min |
| B1 | Schema models | `schema.prisma` | 10min |
| B2 | Keywords | `api/shopping-list/route.ts` | 5min |
| B3 | API routes | `api/shopping-list/check/`, `api/shopping-list/items/` | 15min |
| B4 | Page sync | `shopping-list/page.tsx` | 20min |
| B5 | Merge | `api/shopping-list/route.ts` | 10min |

---

## Verification

```bash
# TypeScript
npx tsc --noEmit

# Build
npm run build

# Migration
npx prisma migrate dev
```

## Rollout

1. Commit to `feature/ai-import-shopping-list` branch
2. Deploy to dev (`icon.local` dev instance)
3. Test URL import + shopping list sync in browser
4. PR to `dev` then `master`
