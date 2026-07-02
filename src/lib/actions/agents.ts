"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import type { FormState } from "./auth";

/** Mise à jour directe de la fiche par la DSI (hors circuit de demande). */
export async function updateAgent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("TECHNICIEN");
  const id = String(formData.get("id") ?? "");
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) return { error: "Agent introuvable." };
  const s = (k: string) => String(formData.get(k) ?? "").trim() || null;
  await prisma.agent.update({
    where: { id },
    data: {
      civilite: s("civilite"),
      nom: String(formData.get("nom") ?? agent.nom).trim() || agent.nom,
      prenom: String(formData.get("prenom") ?? agent.prenom).trim() || agent.prenom,
      matricule: s("matricule"),
      email: s("email"),
      telephone: s("telephone"),
      statutEmploi: s("statutEmploi") ?? agent.statutEmploi,
      direction: s("direction"),
      service: s("service"),
      fonction: s("fonction"),
      site: s("site"),
      responsable: s("responsable"),
      adLogin: s("adLogin"),
      dateArrivee: s("dateArrivee") ? new Date(s("dateArrivee")!) : null,
      dateFinContrat: s("dateFinContrat") ? new Date(s("dateFinContrat")!) : null,
      commentaire: s("commentaire"),
    },
  });
  await audit("AGENT_MODIFIE", {
    userId: user.id,
    cible: `${agent.prenom} ${agent.nom}`,
  });
  revalidatePath(`/agents/${id}`);
  revalidatePath("/agents");
  return { success: "Fiche mise à jour." };
}

/** Attribution directe d'un accès (régularisation d'existant). */
export async function addAccess(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("TECHNICIEN");
  const agentId = String(formData.get("agentId") ?? "");
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) return { error: "Choisissez une application." };
  const existing = await prisma.agentAccess.findFirst({
    where: { agentId, applicationId, statut: { in: ["ACTIF", "A_SUPPRIMER"] } },
  });
  if (existing) return { error: "Cet agent a déjà un accès actif à cette application." };
  const access = await prisma.agentAccess.create({
    data: {
      agentId,
      applicationId,
      profil: String(formData.get("profil") ?? "").trim() || null,
      commentaire: "Attribution directe (hors demande)",
    },
    include: { application: true, agent: true },
  });
  await audit("ACCES_AJOUTE", {
    userId: user.id,
    cible: `${access.agent.prenom} ${access.agent.nom} → ${access.application.nom}`,
  });
  revalidatePath(`/agents/${agentId}`);
  return { success: "Accès ajouté." };
}

export async function removeAccess(accessId: string): Promise<void> {
  const user = await requireUser("TECHNICIEN");
  const access = await prisma.agentAccess.update({
    where: { id: accessId },
    data: { statut: "SUPPRIME", dateSuppression: new Date() },
    include: { application: true, agent: true },
  });
  await audit("ACCES_SUPPRIME", {
    userId: user.id,
    cible: `${access.agent.prenom} ${access.agent.nom} → ${access.application.nom}`,
  });
  revalidatePath(`/agents/${access.agentId}`);
}
