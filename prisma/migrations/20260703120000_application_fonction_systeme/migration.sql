-- CreateEnum
CREATE TYPE "AppFonction" AS ENUM ('MESSAGERIE', 'TELEPHONIE');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "fonction" "AppFonction";

-- CreateIndex
CREATE UNIQUE INDEX "Application_fonction_key" ON "Application"("fonction");
