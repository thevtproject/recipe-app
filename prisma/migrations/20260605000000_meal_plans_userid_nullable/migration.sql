-- Phase 6 follow-up: allow nullable userId for family-scope plans.
-- The Prisma schema declares `userId String?` but the original migration
-- (20260604035444_init) created it as NOT NULL. ALTER in place.
ALTER TABLE "meal_plans" ALTER COLUMN "userId" DROP NOT NULL;
