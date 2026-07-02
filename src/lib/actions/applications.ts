"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import type { FormState } from "./auth";

export async function saveApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("TECHNICIEN");
  const id = String(formData.get("id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom de l'application est obligatoire." };
  const data = {
    nom,
    description: String(formData.get("description") ?? "").trim() || null,
    referent: String(formData.get("referent") ?? "").trim() || null,
    profils: String(formData.get("profils") ?? "").trim() || null,
    actif: formData.get("actif") === "on",
  };
  const duplicate = await prisma.application.findFirst({
    where: { nom, NOT: id ? { id } : undefined },
  });
  if (duplicate) return { error: "Une application porte déjà ce nom." };

  if (id) {
    await prisma.application.update({ where: { id }, data });
    await audit("APPLICATION_MODIFIEE", { userId: user.id, cible: nom });
  } else {
    await prisma.application.create({ data });
    await audit("APPLICATION_CREEE", { userId: user.id, cible: nom });
  }
  revalidatePath("/applications");
  redirect("/applications");
}

export async function deleteApplication(id: string): Promise<void> {
  const user = await requireUser();
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
