-- CreateEnum
CREATE TYPE "StepMode" AS ENUM ('SEQUENTIEL', 'PARALLELE');

-- AlterEnum
ALTER TYPE "Decision" ADD VALUE 'RENVOYE';

-- AlterTable (délégation d'absence)
ALTER TABLE "User" ADD COLUMN     "absent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delegateToId" TEXT,
ADD COLUMN     "delegateFrom" TIMESTAMP(3),
ADD COLUMN     "delegateTo" TIMESTAMP(3);

-- AlterTable (renvoi)
ALTER TABLE "RequestValidation" ADD COLUMN     "targetOrdre" INTEGER;

-- CreateTable
CREATE TABLE "RequestStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "mode" "StepMode" NOT NULL DEFAULT 'SEQUENTIEL',
    "requis" INTEGER NOT NULL DEFAULT 1,
    "validatorRole" "Role",
    "validatorUserIds" TEXT,

    CONSTRAINT "RequestStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestStep_requestId_ordre_key" ON "RequestStep"("requestId", "ordre");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_delegateToId_fkey" FOREIGN KEY ("delegateToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestStep" ADD CONSTRAINT "RequestStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
