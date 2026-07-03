"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import type { FormState } from "./auth";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Enregistre l'absence et la délégation de l'utilisateur connecté : pendant la
 * fenêtre d'absence, ses validations sont aussi proposées au délégué choisi.
 */
export async function saveMyDelegation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const absent = formData.get("absent") === "on";
  const delegateToId = str(formData, "delegateToId") || null;
  const from = str(formData, "delegateFrom");
  const to = str(formData, "delegateTo");

  if (absent && !delegateToId) {
    return { error: "Choisissez un délégué pour la durée de votre absence." };
  }
  if (delegateToId === user.id) {
    return { error: "Vous ne pouvez pas vous déléguer à vous-même." };
  }
  if (delegateToId) {
    const target = await prisma.user.findUnique({ where: { id: delegateToId } });
    if (!target?.active) return { error: "Le délégué choisi est introuvable ou inactif." };
  }
  if (from && to && new Date(from) > new Date(to)) {
    return { error: "La date de début doit précéder la date de fin." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      absent,
      delegateToId: absent ? delegateToId : null,
      delegateFrom: absent && from ? new Date(from) : null,
      delegateTo: absent && to ? new Date(to) : null,
    },
  });
  await audit(absent ? "DELEGATION_ACTIVEE" : "DELEGATION_DESACTIVEE", {
    userId: user.id,
    cible: user.displayName,
  });
  revalidatePath("/absences");
  return {
    success: absent
      ? "Absence enregistrée : vos validations sont déléguées."
      : "Absence désactivée.",
  };
}
