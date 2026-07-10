"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppFonction } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import type { FormState } from "./auth";

const APP_FONCTIONS: AppFonction[] = [
  "MESSAGERIE",
  "TELEPHONIE",
  "COMPTE_AD",
  "CONTROLE_ACCES",
  "PARC",
  "POSTE",
];

export async function saveApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("TECHNICIEN");
  const id = String(formData.get("id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom de l'application est obligatoire." };
  const rawFonction = String(formData.get("fonction") ?? "");
  const fonction = APP_FONCTIONS.includes(rawFonction as AppFonction)
    ? (rawFonction as AppFonction)
    : null;
  const data = {
    nom,
    description: String(formData.get("description") ?? "").trim() || null,
    referent: String(formData.get("referent") ?? "").trim() || null,
    profils: String(formData.get("profils") ?? "").trim() || null,
    fonction,
    actif: formData.get("actif") === "on",
  };
  const duplicate = await prisma.application.findFirst({
    where: { nom, NOT: id ? { id } : undefined },
  });
  if (duplicate) return { error: "Une application porte déjà ce nom." };

  // une fonction système ne peut être portée que par une seule application :
  // si une autre la détient déjà, on la lui retire (déplacement), le tout en
  // une transaction pour respecter la contrainte d'unicité.
  const ops = [];
  if (fonction) {
    ops.push(
      prisma.application.updateMany({
        where: { fonction, NOT: id ? { id } : undefined },
        data: { fonction: null },
      }),
    );
  }
  ops.push(
    id
      ? prisma.application.update({ where: { id }, data })
      : prisma.application.create({ data }),
  );
  await prisma.$transaction(ops);
  await audit(id ? "APPLICATION_MODIFIEE" : "APPLICATION_CREEE", {
    userId: user.id,
    cible: nom,
  });
  revalidatePath("/applications");
  redirect("/applications");
}

export async function deleteApplication(id: string): Promise<void> {
  const user = await requireUser("TECHNICIEN");
  const app = await prisma.application.findUnique({
    where: { id },
    include: { _count: { select: { accesses: true } } },
  });
  if (!app) return;
  if (app._count.accesses > 0) {
    // des accès y sont rattachés : on désactive au lieu de supprimer
    await prisma.application.update({ where: { id }, data: { actif: false } });
    await audit("APPLICATION_DESACTIVEE", { userId: user.id, cible: app.nom });
  } else {
    await prisma.application.delete({ where: { id } });
    await audit("APPLICATION_SUPPRIMEE", { userId: user.id, cible: app.nom });
  }
  revalidatePath("/applications");
}
