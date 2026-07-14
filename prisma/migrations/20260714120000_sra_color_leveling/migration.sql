-- Replace the rung/pbToNext ladder model with the level/color/passing-sets model.

-- User: drop old position columns, add the new ones (schema keeps their defaults).
ALTER TABLE "User" DROP COLUMN "currentRung";
ALTER TABLE "User" DROP COLUMN "pbToNext";
ALTER TABLE "User" ADD COLUMN "levelIdx" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "colorIdx" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "pbPassed" INTEGER NOT NULL DEFAULT 0;

-- Report: move from a single pb count to kind-based records.
ALTER TABLE "Report" RENAME COLUMN "pb" TO "pbCount";
-- Temporary defaults let us add NOT NULL columns to any existing rows; dropped
-- afterward so the columns match the (default-less) Prisma schema.
ALTER TABLE "Report" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'powerbuilder';
ALTER TABLE "Report" ADD COLUMN "levelIdx" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Report" ADD COLUMN "passed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Report" ADD COLUMN "placementColorIdx" INTEGER;

-- Backfill: historical scores are on the same 1–10 scale, 6+ counts as passing.
UPDATE "Report" SET "passed" = ("score" >= 6);

ALTER TABLE "Report" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "levelIdx" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "passed" DROP DEFAULT;
