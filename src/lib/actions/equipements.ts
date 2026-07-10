"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import { findDirectoryAccount, searchDirectory } from "../directory";
import type { FormState } from "./auth";

/** Un responsable choisi dans l'annuaire AD. */
export type ResponsableAd = {
  samAccountName: string;
  displayName: string;
  email?: string | null;
};

export type EquipementInput = {
  id?: string;
  nom: string;
  responsable?: ResponsableAd | null;
  actif: boolean;
};

/**
 * Recherche des comptes dans l'annuaire AD synchronisé pour désigner le
 * responsable d'un équipement. Renvoie au plus 10 comptes actifs.
 */
export async function searchAdAccounts(query: string): Promise<ResponsableAd[]> {
  await requireUser("ADMIN");
  const accounts = await searchDirectory(query);
  return accounts
    .filter((a) => a.enabled)
    .map((a) => ({
      samAccountName: a.samAccountName,
      displayName: a.displayName,
      email: a.email,
    }));
}

/**
 * Rattache un responsable AD à un compte utilisateur Sésame (créé à la volée
 * s'il n'existe pas), afin qu'il puisse recevoir les notifications de tâches
 * (magic link). Le compte n'est accepté que s'il existe et est actif dans
 * l'annuaire AD synchronisé (on ne fait pas confiance au nom/email envoyés par
 * le client). Renvoie l'id de l'utilisateur, ou null si le compte est invalide.
 */
async function resolveResponsable(resp: ResponsableAd): Promise<string | null> {
  const login = resp.samAccountName.trim().toLowerCase();
  if (!login) return null;
  // revalidation serveur : le compte doit exister et être actif dans l'AD
  const account = await findDirectoryAccount(login);
  if (!account || !account.enabled) return null;
  // on utilise les valeurs canoniques de l'annuaire, pas celles du client
  const displayName = account.displayName ?? account.samAccountName;
  const user = await prisma.user.upsert({
    where: { login },
    update: { displayName, email: account.email ?? undefined },
    create: { login, displayName, email: account.email ?? undefined, isLocal: false },
  });
  return user.id;
}

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

  let responsableId: string | null = null;
  if (input.responsable) {
    responsableId = await resolveResponsable(input.responsable);
    if (!responsableId) {
      return {
        error:
          "Responsable introuvable ou désactivé dans l'annuaire AD. Relancez une synchronisation puis resélectionnez-le.",
      };
    }
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
