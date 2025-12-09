-- CreateTable
CREATE TABLE "public"."Availability" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WEEKLY',
    "dayOfWeek" INTEGER,
    "specificDate" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_professionalId_idx" ON "public"."Availability"("professionalId");

-- CreateIndex
CREATE INDEX "Availability_dayOfWeek_idx" ON "public"."Availability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "Availability_specificDate_idx" ON "public"."Availability"("specificDate");

-- CreateIndex
CREATE INDEX "Availability_isActive_idx" ON "public"."Availability"("isActive");

-- AddForeignKey
ALTER TABLE "public"."Availability" ADD CONSTRAINT "Availability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

