-- Drop the legacy UNIQUE INDEX on meal_plans(userId, date, mealType)
-- The original migration tried DROP CONSTRAINT but this was a UNIQUE
-- INDEX (Prisma's default for @@unique), not a table-level constraint.
-- Multi-recipe per slot requires it gone.
DROP INDEX IF EXISTS "meal_plans_userId_date_mealType_key";
