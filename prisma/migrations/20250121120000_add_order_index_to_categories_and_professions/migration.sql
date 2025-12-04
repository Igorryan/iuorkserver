-- AlterTable
ALTER TABLE "ProfessionCategory" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Profession" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ProfessionCategory_orderIndex_idx" ON "ProfessionCategory"("orderIndex");

-- CreateIndex
CREATE INDEX "Profession_orderIndex_idx" ON "Profession"("orderIndex");

