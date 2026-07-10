"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import type { FormState } from "./auth";

export type ServiceInput = {
  id?: string;
  nom: string;
  description?: string;
  actif: boolean;
  applicationIds: string[];
  adGroups?: string[]; // groupes AD rattachés (DN ou nom)
  workflowCreationId?: string | null;
  workflowModificationId?: string | null;
  workflowDepartId?: string | null;
};

/**
 * Vérifie qu'un circuit rattaché existe bien et correspond au type attendu,
 * pour éviter d'associer un circuit d'un autre type à un mauvais emplacement.
 */
async function validWorkflowId(
  id: string | null | undefined,
  type: "CREATION" | "MODIFICATION" | "DEPART",
): Promise<string | null> {
  if (!id) return null;
  const wf = await prisma.workflow.findUnique({ where: { id } });
  return wf && wf.type === type ? id : null;
}

/** Crée ou met à jour un service (rattachements applications + circuits). */
export async function saveService(
  input: ServiceInput,
): Promise<FormState & { id?: string }> {
  const user = await requireUser("ADMIN");
  const nom = input.nom.trim();
  if (!nom) return { error: "Donnez un nom au service." };

  const duplicate = await prisma.service.findFirst({
    where: {
      nom: { equals: nom, mode: "insensitive" },
      NOT: input.id ? { id: input.id } : undefined,
    },
  });
  if (duplicate) return { error: "Un service porte déjà ce nom." };

  // groupes AD rattachés : nettoyés, dédoublonnés, stockés un par ligne
  const adGroups = [...new Set((input.adGroups ?? []).map((g) => g.trim()).filter(Boolean))];

  const data = {
    nom,
    description: input.description?.trim() || null,
    actif: input.actif,
    adGroups: adGroups.length > 0 ? adGroups.join("\n") : null,
    workflowCreationId: await validWorkflowId(input.workflowCreationId, "CREATION"),
    workflowModificationId: await validWorkflowId(
      input.workflowModificationId,
      "MODIFICATION",
    ),
    workflowDepartId: await validWorkflowId(input.workflowDepartId, "DEPART"),
  };

  const service = input.id
    ? await prisma.service.update({ where: { id: input.id }, data })
    : await prisma.service.create({ data });

  // remplace la liste des applications rattachées
  const applicationIds = [...new Set(input.applicationIds)].filter(Boolean);
  await prisma.$transaction([
    prisma.serviceApplication.deleteMany({ where: { serviceId: service.id } }),
    prisma.serviceApplication.createMany({
      data: applicationIds.map((applicationId) => ({
        serviceId: service.id,
        applicationId,
      })),
      skipDuplicates: true,
    }),
  ]);

  await audit(input.id ? "SERVICE_MODIFIE" : "SERVICE_CREE", {
    userId: user.id,
    cible: nom,
    details: `${applicationIds.length} application(s) rattachée(s)`,
  });
  revalidatePath("/parametres/services");
  return { success: `Service « ${nom} » enregistré.`, id: service.id };
}

export async function deleteService(id: string): Promise<void> {
  const user = await requireUser("ADMIN");
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return;
  await prisma.service.delete({ where: { id } }); // les rattachements cascadent
  await audit("SERVICE_SUPPRIME", { userId: user.id, cible: service.nom });
  revalidatePath("/parametres/services");
}
