-- CreateTable
CREATE TABLE "ProfessionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionCategory_name_key" ON "ProfessionCategory"("name");
CREATE UNIQUE INDEX "ProfessionCategory_slug_key" ON "ProfessionCategory"("slug");

-- AlterTable
ALTER TABLE "Profession" ADD COLUMN "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Profession" ADD CONSTRAINT "Profession_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProfessionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

