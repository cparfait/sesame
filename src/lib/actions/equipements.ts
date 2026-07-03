"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import type { FormState } from "./auth";

export type EquipementInput = {
  id?: string;
  nom: string;
  responsableId?: string | null;
  actif: boolean;
};

export async function saveEquipement(
  input: EquipementInput,
): Promise<FormState & { id?: string }> {
  const user = await requireUser("ADMIN");
  const nom = input.nom.trim();
  if (!nom) return { error: "Donnez un nom à l'équipement." };

  const duplicate = await prisma.equipement.findFirst({
    where: {
      nom: { equals: nom, mode: "insensitive" },
      NOT: input.id ? { id: input.id } : undefined,
    },
  });
  if (duplicate) return { error: "Un équipement porte déjà ce nom." };

  let responsableId = input.responsableId || null;
  if (responsableId) {
    const resp = await prisma.user.findUnique({ where: { id: responsableId } });
    if (!resp?.active) responsableId = null;
  }

  const data = { nom, responsableId, actif: input.actif };
  const equipement = input.id
    ? await prisma.equipement.update({ where: { id: input.id }, data })
    : await prisma.equipement.create({ data });

  await audit(input.id ? "EQUIPEMENT_MODIFIE" : "EQUIPEMENT_CREE", {
    userId: user.id,
    cible: nom,
  });
  revalidatePath("/parametres/equipements");
  return { success: `Équipement « ${nom} » enregistré.`, id: equipement.id };
}

export async function deleteEquipement(id: string): Promise<void> {
  const user = await requireUser("ADMIN");
  const equipement = await prisma.equipement.findUnique({ where: { id } });
  if (!equipement) return;
  await prisma.equipement.delete({ where: { id } });
  await audit("EQUIPEMENT_SUPPRIME", { userId: user.id, cible: equipement.nom });
  revalidatePath("/parametres/equipements");
}
