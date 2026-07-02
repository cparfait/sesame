-- DropIndex
DROP INDEX "WorkflowStep_type_ordre_key";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "teletravail" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'local';

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "workflowId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowStep" DROP COLUMN "type",
ADD COLUMN     "workflowId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "matchService" TEXT,
    "matchAdGroup" TEXT,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_externalId_key" ON "Application"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowId_ordre_key" ON "WorkflowStep"("workflowId", "ordre");

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

