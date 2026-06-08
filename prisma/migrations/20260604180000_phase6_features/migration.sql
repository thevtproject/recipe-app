-- Phase 6: Family features, multi-category, multi-recipe slots, ratings, cooked history, plan shares

-- 1. New tables
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "households_inviteCode_key" ON "households"("inviteCode");

CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ratings_userId_recipeId_key" ON "ratings"("userId", "recipeId");
CREATE INDEX "ratings_recipeId_idx" ON "ratings"("recipeId");
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE;

CREATE TABLE "cooked_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "cookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cooked_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cooked_history_userId_idx" ON "cooked_history"("userId");
CREATE INDEX "cooked_history_recipeId_idx" ON "cooked_history"("recipeId");
CREATE INDEX "cooked_history_recipeId_cookedAt_idx" ON "cooked_history"("recipeId", "cookedAt");
ALTER TABLE "cooked_history" ADD CONSTRAINT "cooked_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "cooked_history" ADD CONSTRAINT "cooked_history_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE;

CREATE TABLE "plan_shares" (
    "token" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_shares_pkey" PRIMARY KEY ("token")
);
CREATE INDEX "plan_shares_token_idx" ON "plan_shares"("token");
CREATE INDEX "plan_shares_refId_idx" ON "plan_shares"("refId");

-- 2. User.householdId
ALTER TABLE "users" ADD COLUMN "householdId" TEXT;
CREATE INDEX "users_householdId_idx" ON "users"("householdId");
ALTER TABLE "users" ADD CONSTRAINT "users_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL;

-- 3. Recipe new columns
ALTER TABLE "recipes" ADD COLUMN "categories" "MealCategory"[] NOT NULL DEFAULT '{}';
ALTER TABLE "recipes" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "recipes" ADD COLUMN "ratingAvg" DOUBLE PRECISION;
ALTER TABLE "recipes" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recipes" ADD COLUMN "lastCookedAt" TIMESTAMP(3);

-- 4. Backfill categories from old single category
UPDATE "recipes" SET "categories" = ARRAY["category"]::"MealCategory"[];

-- 5. Drop the old unique constraint on meal_plans (allow multiple recipes per slot)
ALTER TABLE "meal_plans" DROP CONSTRAINT IF EXISTS "meal_plans_userId_date_mealType_key";

-- 6. Add MealPlan.householdId
ALTER TABLE "meal_plans" ADD COLUMN "householdId" TEXT;
CREATE INDEX "meal_plans_householdId_date_idx" ON "meal_plans"("householdId", "date");
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE;

-- 7. Check constraint: exactly one of userId / householdId
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_one_owner_check" 
    CHECK (("userId" IS NOT NULL) <> ("householdId" IS NOT NULL));

-- 8. Add new indexes on recipes for sort performance
CREATE INDEX "recipes_ratingAvg_idx" ON "recipes"("ratingAvg");
CREATE INDEX "recipes_lastCookedAt_idx" ON "recipes"("lastCookedAt");

-- 9. Now we can drop the old `category` column (after backfill, all data preserved in `categories`)
-- Keep `category` column for safety — will be removed in a follow-up migration
-- ALTER TABLE "recipes" DROP COLUMN "category";
