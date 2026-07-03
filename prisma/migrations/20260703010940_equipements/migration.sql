-- CreateTable
CREATE TABLE "Equipement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "responsableId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipement_nom_key" ON "Equipement"("nom");

-- CreateIndex
CREATE INDEX "Equipement_responsableId_idx" ON "Equipement"("responsableId");

-- AddForeignKey
ALTER TABLE "Equipement" ADD CONSTRAINT "Equipement_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise des équipements par défaut (auparavant codés en dur)
INSERT INTO "Equipement" ("id", "nom", "actif", "createdAt") VALUES
    ('equip_poste_fixe', 'Poste informatique fixe', true, CURRENT_TIMESTAMP),
    ('equip_portable', 'Ordinateur portable', true, CURRENT_TIMESTAMP),
    ('equip_tel_fixe', 'Téléphone fixe', true, CURRENT_TIMESTAMP),
    ('equip_tel_mobile', 'Téléphone mobile', true, CURRENT_TIMESTAMP),
    ('equip_badge', 'Badge d''accès', true, CURRENT_TIMESTAMP),
    ('equip_code_copieur', 'Code copieur / impression', true, CURRENT_TIMESTAMP),
    ('equip_cles', 'Clés / accès aux locaux', true, CURRENT_TIMESTAMP);
