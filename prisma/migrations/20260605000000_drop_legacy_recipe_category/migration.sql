-- Phase 6: drop the legacy single `category` column now that recipes use
-- the `categories` array. Was kept around for back-compat; not referenced
-- by the Prisma schema or any code path.
ALTER TABLE "recipes" DROP COLUMN "category";
