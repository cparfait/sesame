-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VALIDATEUR', 'TECHNICIEN', 'DEMANDEUR', 'LECTEUR');

-- CreateEnum
CREATE TYPE "AgentStatut" AS ENUM ('ACTIF', 'PARTI');

-- CreateEnum
CREATE TYPE "AccessStatut" AS ENUM ('ACTIF', 'A_SUPPRIMER', 'SUPPRIME');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('CREATION', 'MODIFICATION', 'DEPART');

-- CreateEnum
CREATE TYPE "RequestStatut" AS ENUM ('EN_VALIDATION', 'APPROUVEE', 'REFUSEE', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROUVE', 'REFUSE');

-- CreateEnum
CREATE TYPE "TaskStatut" AS ENUM ('A_FAIRE', 'FAIT', 'NON_APPLICABLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DEMANDEUR',
    "isLocal" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "civilite" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "matricule" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "statutEmploi" TEXT NOT NULL,
    "direction" TEXT,
    "service" TEXT,
    "fonction" TEXT,
    "site" TEXT,
    "responsable" TEXT,
    "dateArrivee" TIMESTAMP(3),
    "dateDepart" TIMESTAMP(3),
    "dateFinContrat" TIMESTAMP(3),
    "statut" "AgentStatut" NOT NULL DEFAULT 'ACTIF',
    "adLogin" TEXT,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "referent" TEXT,
    "profils" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAccess" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "profil" TEXT,
    "statut" "AccessStatut" NOT NULL DEFAULT 'ACTIF',
    "dateAttribution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateSuppression" TIMESTAMP(3),
    "commentaire" TEXT,

    CONSTRAINT "AgentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "ordre" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "validatorRole" "Role",
    "validatorUserIds" TEXT,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "type" "RequestType" NOT NULL,
    "statut" "RequestStatut" NOT NULL DEFAULT 'EN_VALIDATION',
    "requesterId" TEXT NOT NULL,
    "agentId" TEXT,
    "payload" JSONB NOT NULL,
    "currentStepOrdre" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestValidation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrdre" INTEGER NOT NULL,
    "stepNom" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "userId" TEXT NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisionTask" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "applicationId" TEXT,
    "statut" "TaskStatut" NOT NULL DEFAULT 'A_FAIRE',
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "ProvisionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "samAccountName" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "dn" TEXT NOT NULL,
    "ou" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastLogon" TIMESTAMP(3),
    "groups" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "cible" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Application_nom_key" ON "Application"("nom");

-- CreateIndex
CREATE INDEX "AgentAccess_agentId_idx" ON "AgentAccess"("agentId");

-- CreateIndex
CREATE INDEX "AgentAccess_applicationId_idx" ON "AgentAccess"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_type_ordre_key" ON "WorkflowStep"("type", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Request_numero_key" ON "Request"("numero");

-- CreateIndex
CREATE INDEX "Request_statut_idx" ON "Request"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_samAccountName_key" ON "AdAccount"("samAccountName");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AgentAccess" ADD CONSTRAINT "AgentAccess_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAccess" ADD CONSTRAINT "AgentAccess_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestValidation" ADD CONSTRAINT "RequestValidation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestValidation" ADD CONSTRAINT "RequestValidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionTask" ADD CONSTRAINT "ProvisionTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionTask" ADD CONSTRAINT "ProvisionTask_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionTask" ADD CONSTRAINT "ProvisionTask_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
