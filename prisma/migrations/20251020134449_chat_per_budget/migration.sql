-- DropIndex
DROP INDEX IF EXISTS "Chat_clientId_professionalId_serviceId_key";

-- DropIndex
DROP INDEX IF EXISTS "Budget_chatId_idx";

-- AlterTable
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_clientId_professionalId_serviceId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Budget_chatId_key" ON "Budget"("chatId");

