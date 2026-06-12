-- Add sourceUrl to recipes
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

-- Create shopping_list_checks table for persisting check state
CREATE TABLE IF NOT EXISTS "shopping_list_checks" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "weekStart" DATE NOT NULL,
    "itemKey" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT true,
    "checkedBy" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shopping_list_checks_householdId_weekStart_itemKey_key"
    ON "shopping_list_checks"("householdId", "weekStart", "itemKey");

CREATE INDEX IF NOT EXISTS "shopping_list_checks_householdId_weekStart_idx"
    ON "shopping_list_checks"("householdId", "weekStart");

-- Create shopping_list_items table for manually added items
CREATE TABLE IF NOT EXISTS "shopping_list_items" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "amount" TEXT,
    "unit" TEXT,
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shopping_list_items_householdId_weekStart_idx"
    ON "shopping_list_items"("householdId", "weekStart");
