-- DropForeignKey
ALTER TABLE "public"."ServiceImage" DROP CONSTRAINT "ServiceImage_serviceId_fkey";

-- AddForeignKey
ALTER TABLE "public"."ServiceImage" ADD CONSTRAINT "ServiceImage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
