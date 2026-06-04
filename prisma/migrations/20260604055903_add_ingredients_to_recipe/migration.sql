-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "ingredients" JSONB NOT NULL DEFAULT '[]';
