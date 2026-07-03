-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowCreationId" TEXT,
    "workflowModificationId" TEXT,
    "workflowDepartId" TEXT,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceApplication" (
    "serviceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,

    CONSTRAINT "ServiceApplication_pkey" PRIMARY KEY ("serviceId","applicationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_nom_key" ON "Service"("nom");

-- CreateIndex
CREATE INDEX "ServiceApplication_applicationId_idx" ON "ServiceApplication"("applicationId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_workflowCreationId_fkey" FOREIGN KEY ("workflowCreationId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_workflowModificationId_fkey" FOREIGN KEY ("workflowModificationId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_workflowDepartId_fkey" FOREIGN KEY ("workflowDepartId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceApplication" ADD CONSTRAINT "ServiceApplication_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceApplication" ADD CONSTRAINT "ServiceApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
