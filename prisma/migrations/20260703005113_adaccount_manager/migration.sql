-- AlterTable
ALTER TABLE "AdAccount" ADD COLUMN     "manager" TEXT;

-- CreateIndex
CREATE INDEX "AdAccount_manager_idx" ON "AdAccount"("manager");
