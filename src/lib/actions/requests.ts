"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import { findDirectoryAccount, searchDirectory } from "../directory";
import {
  checkCompletion,
  createRequest,
  decide,
  launchRequest,
  sendBack,
  updateRequestCircuit,
} from "../workflow";
import { REQUEST_TYPE_LABELS } from "../constants";
import type {
  AppDemandee,
  CircuitStepInput,
  CreationPayload,
  DepartPayload,
  ModificationPayload,
} from "../constants";
import type { FormState } from "./auth";
import type { TaskStatut } from "@prisma/client";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export type AdAgentOption = {
  samAccountName: string;
  displayName: string;
  email?: string | null;
  ou?: string | null;
};

/**
 * Recherche de comptes dans l'annuaire AD synchronisé pour désigner l'agent
 * concerné d'une demande de modification / départ.
 */
export async function searchAdAgents(query: string): Promise<AdAgentOption[]> {
  await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const accounts = await searchDirectory(query);
  return accounts.map((a) => ({
    samAccountName: a.samAccountName,
    displayName: a.displayName,
    email: a.email,
    ou: a.ou,
  }));
}

/**
 * Découpe un `displayName` AD en nom / prénom (best-effort, ajustable ensuite
 * dans la fiche) : gère « NOM, Prénom », le nom de famille tout en majuscules,
 * et par défaut « Prénom NOM » (dernier mot = nom).
 */
function splitDisplayName(dn: string): { nom: string; prenom: string } {
  const clean = dn.trim().replace(/\s+/g, " ");
  if (clean.includes(",")) {
    const [nom, prenom] = clean.split(",").map((s) => s.trim());
    return { nom: nom || clean, prenom: prenom || "" };
  }
  const parts = clean.split(" ");
  if (parts.length === 1) return { nom: parts[0], prenom: "" };
  const upper = parts.filter((p) => p.length > 1 && p === p.toUpperCase());
  if (upper.length > 0 && upper.length < parts.length) {
    return {
      nom: upper.join(" "),
      prenom: parts.filter((p) => !upper.includes(p)).join(" "),
    };
  }
  return { nom: parts[parts.length - 1], prenom: parts.slice(0, -1).join(" ") };
}

/**
 * Résout la fiche agent locale correspondant à un compte AD (rapprochement par
 * `adLogin`). Crée une fiche minimale depuis l'annuaire si aucune n'existe, afin
 * de lancer une demande de modification / départ. Renvoie l'id de la fiche.
 */
export async function resolveAgentFromAd(
  samAccountName: string,
): Promise<{ id?: string; error?: string }> {
  const user = await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const login = samAccountName.trim().toLowerCase();
  if (!login) return { error: "Compte AD invalide." };

  const account = await findDirectoryAccount(login);
  if (!account) return { error: "Compte introuvable dans l'annuaire AD." };

  const existing = await prisma.agent.findFirst({
    where: { adLogin: { equals: login, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { id: existing.id };

  const { nom, prenom } = splitDisplayName(account.displayName ?? account.samAccountName);
  const agent = await prisma.agent.create({
    data: {
      nom,
      prenom,
      statutEmploi: "Autre",
      email: account.email ?? null,
      adLogin: account.samAccountName,
    },
    select: { id: true },
  });
  await audit("AGENT_CREE_DEPUIS_AD", { userId: user.id, cible: account.samAccountName });
  return { id: agent.id };
}

/** Applications cochées dans le formulaire : champs app_<id> + profil_<id>. */
async function parseApplications(formData: FormData): Promise<AppDemandee[]> {
  const ids: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("app_") && value === "on") ids.push(key.slice(4));
  }
  if (ids.length === 0) return [];
  const apps = await prisma.application.findMany({ where: { id: { in: ids } } });
  return apps.map((a) => ({
    applicationId: a.id,
    nom: a.nom,
    profil: str(formData, `profil_${a.id}`) || undefined,
  }));
}

export async function createCreationRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const nom = str(formData, "nom");
  const prenom = str(formData, "prenom");
  const statutEmploi = str(formData, "statutEmploi");
  if (!nom || !prenom || !statutEmploi) {
    return { error: "Nom, prénom et statut d'emploi sont obligatoires." };
  }
  const payload: CreationPayload = {
    civilite: str(formData, "civilite") || undefined,
    nom,
    prenom,
    matricule: str(formData, "matricule") || undefined,
    email: str(formData, "email") || undefined,
    telephone: str(formData, "telephone") || undefined,
    statutEmploi,
    direction: str(formData, "direction") || undefined,
    service: str(formData, "service") || undefined,
    fonction: str(formData, "fonction") || undefined,
    site: str(formData, "site") || undefined,
    responsable: str(formData, "responsable") || undefined,
    dateArrivee: str(formData, "dateArrivee") || undefined,
    dateFinContrat: str(formData, "dateFinContrat") || undefined,
    teletravail: str(formData, "teletravail") || undefined,
    copieDe: str(formData, "copieDe") || undefined,
    applications: await parseApplications(formData),
    equipements: formData.getAll("equipements").map(String),
    commentaire: str(formData, "commentaire") || undefined,
  };
  const request = await createRequest(user, "CREATION", payload);
  redirect(`/demandes/${request.id}`);
}

export async function createModificationRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const agentId = str(formData, "agentId");
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { error: "Sélectionnez l'agent concerné." };

  // Ne retenir que les champs réellement modifiés par rapport à la fiche actuelle
  const champs: ModificationPayload["champs"] = {};
  const compare: [keyof ModificationPayload["champs"], string | null][] = [
    ["email", agent.email],
    ["telephone", agent.telephone],
    ["statutEmploi", agent.statutEmploi],
    ["direction", agent.direction],
    ["service", agent.service],
    ["fonction", agent.fonction],
    ["site", agent.site],
    ["responsable", agent.responsable],
    ["teletravail", agent.teletravail],
    [
      "dateFinContrat",
      agent.dateFinContrat ? agent.dateFinContrat.toISOString().slice(0, 10) : null,
    ],
  ];
  for (const [key, current] of compare) {
    const submitted = str(formData, key);
    if (submitted !== (current ?? "")) champs[key] = submitted;
  }

  const removeAccess: ModificationPayload["removeAccess"] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("remove_") && value === "on") {
      const accessId = key.slice(7);
      const access = await prisma.agentAccess.findUnique({
        where: { id: accessId },
        include: { application: true },
      });
      if (access && access.agentId === agentId) {
        removeAccess.push({
          accessId,
          label: `${access.application.nom}${access.profil ? ` (${access.profil})` : ""}`,
        });
      }
    }
  }

  const addApplications = await parseApplications(formData);
  const commentaire = str(formData, "commentaire") || undefined;

  if (
    Object.keys(champs).length === 0 &&
    addApplications.length === 0 &&
    removeAccess.length === 0
  ) {
    return { error: "Aucune modification saisie : la fiche est identique à l'existant." };
  }

  const payload: ModificationPayload = {
    agentNom: `${agent.prenom} ${agent.nom}`,
    champs,
    addApplications,
    removeAccess,
    commentaire,
  };
  const request = await createRequest(user, "MODIFICATION", payload, agentId);
  redirect(`/demandes/${request.id}`);
}

export async function createDepartRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const agentId = str(formData, "agentId");
  const dateDepart = str(formData, "dateDepart");
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { accesses: { where: { statut: "ACTIF" }, include: { application: true } } },
  });
  if (!agent) return { error: "Sélectionnez l'agent concerné." };
  if (!dateDepart) return { error: "La date de départ est obligatoire." };

  const existing = await prisma.request.findFirst({
    where: { agentId, type: "DEPART", statut: { in: ["EN_VALIDATION", "APPROUVEE"] } },
  });
  if (existing) {
    return { error: `Un départ est déjà en cours pour cet agent (demande n° ${existing.numero}).` };
  }

  const payload: DepartPayload = {
    agentNom: `${agent.prenom} ${agent.nom}`,
    dateDepart,
    motif: str(formData, "motif") || undefined,
    accesses: agent.accesses.map((a) => ({
      accessId: a.id,
      label: `${a.application.nom}${a.profil ? ` (${a.profil})` : ""}`,
    })),
    commentaire: str(formData, "commentaire") || undefined,
  };
  const request = await createRequest(user, "DEPART", payload, agentId);
  redirect(`/demandes/${request.id}`);
}

// ── Circuit en brouillon : enregistrer / lancer ────────────────────────────

export async function updateCircuitAction(
  requestId: string,
  steps: CircuitStepInput[],
): Promise<FormState> {
  const user = await requireUser();
  const result = await updateRequestCircuit(requestId, user, steps);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/demandes/${requestId}`);
  return { success: "Circuit enregistré." };
}

export async function launchRequestAction(
  requestId: string,
  steps: CircuitStepInput[],
): Promise<FormState> {
  const user = await requireUser();
  const result = await launchRequest(requestId, user, steps);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes");
  return { success: "Demande lancée dans le circuit." };
}

// ── Validation / refus ─────────────────────────────────────────────────────

export async function decideAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // l'habilitation réelle est vérifiée par canDecide (valideur nommé ou par rôle,
  // délégué d'absence, ou ADMIN) — quel que soit le rôle Sésame de l'utilisateur.
  const user = await requireUser();
  const requestId = str(formData, "requestId");
  const raw = str(formData, "decision");
  const commentaire = str(formData, "commentaire");

  if (raw === "RENVOYE") {
    const targetOrdre = Number(str(formData, "targetOrdre"));
    if (!Number.isInteger(targetOrdre)) {
      return { error: "Sélectionnez l'étape de renvoi." };
    }
    const result = await sendBack(requestId, user, targetOrdre, commentaire);
    if (!result.ok) return { error: result.error };
    revalidatePath(`/demandes/${requestId}`);
    revalidatePath("/demandes");
    return { success: "Demande renvoyée pour correction." };
  }

  const decision = raw === "REFUSE" ? "REFUSE" : "APPROUVE";
  if (decision === "REFUSE" && !commentaire) {
    return { error: "Un commentaire est obligatoire en cas de refus." };
  }
  const result = await decide(requestId, user, decision, commentaire || undefined);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes");
  return { success: decision === "APPROUVE" ? "Étape validée." : "Demande refusée." };
}

// ── Tâches de provisionnement ──────────────────────────────────────────────

export async function setTaskStatut(taskId: string, statut: TaskStatut): Promise<void> {
  const user = await requireUser();
  const existing = await prisma.provisionTask.findUnique({ where: { id: taskId } });
  if (!existing) return;
  // techniciens/valideurs/admin, ou le responsable désigné de la tâche
  const allowed =
    ["ADMIN", "TECHNICIEN", "VALIDATEUR"].includes(user.role) ||
    existing.responsableId === user.id;
  if (!allowed) return;

  const task = await prisma.provisionTask.update({
    where: { id: taskId },
    data: {
      statut,
      doneById: statut === "A_FAIRE" ? null : user.id,
      doneAt: statut === "A_FAIRE" ? null : new Date(),
    },
  });
  await checkCompletion(task.requestId);
  revalidatePath(`/demandes/${task.requestId}`);
  revalidatePath("/demandes");
  revalidatePath("/taches");
}

// ── Annulation ─────────────────────────────────────────────────────────────

export async function cancelRequest(requestId: string): Promise<void> {
  const user = await requireUser();
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request || !["BROUILLON", "EN_VALIDATION"].includes(request.statut)) return;
  if (request.requesterId !== user.id && user.role !== "ADMIN") return;
  await prisma.request.update({
    where: { id: requestId },
    data: { statut: "ANNULEE", closedAt: new Date() },
  });
  await audit("DEMANDE_ANNULEE", {
    userId: user.id,
    cible: `Demande n° ${request.numero}`,
  });
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes");
}

/**
 * Supprime définitivement une demande (réservé aux administrateurs) : efface
 * aussi ses étapes, validations et tâches (cascade). Contrairement à
 * l'annulation, aucune trace de la demande n'est conservée — seul le journal
 * garde l'événement de suppression.
 */
export async function deleteRequest(requestId: string): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { error: "Demande introuvable." };
  await prisma.request.delete({ where: { id: requestId } });
  await audit("DEMANDE_SUPPRIMEE", {
    userId: user.id,
    cible: `Demande n° ${request.numero}`,
    details: REQUEST_TYPE_LABELS[request.type],
  });
  revalidatePath("/demandes");
  return { success: `Demande n° ${request.numero} supprimée.` };
}
