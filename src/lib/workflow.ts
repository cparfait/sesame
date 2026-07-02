import type {
  Decision,
  Request,
  RequestType,
  User,
  Workflow,
  WorkflowStep,
} from "@prisma/client";
import { prisma } from "./db";
import { audit } from "./audit";
import { mailLayout, sendMail } from "./mail";
import {
  REQUEST_TYPE_LABELS,
  type CreationPayload,
  type DepartPayload,
  type ModificationPayload,
} from "./constants";

// ── Sélection du circuit applicable ────────────────────────────────────────

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Choisit le circuit de validation d'une nouvelle demande :
 * 1. parmi les circuits actifs du type, dans l'ordre de priorité décroissante,
 *    le premier dont TOUS les critères définis correspondent
 *    (service de la demande, groupe AD du demandeur) ;
 * 2. sinon le circuit marqué « par défaut » ;
 * 3. sinon aucun circuit → approbation immédiate.
 */
export async function selectWorkflow(
  type: RequestType,
  requester: User,
  service: string | null | undefined,
): Promise<(Workflow & { steps: WorkflowStep[] }) | null> {
  const candidates = await prisma.workflow.findMany({
    where: { type, actif: true },
    include: { steps: { orderBy: { ordre: "asc" } } },
    orderBy: [{ priorite: "desc" }, { createdAt: "asc" }],
  });
  if (candidates.length === 0) return null;

  let adGroups: string[] = [];
  const adAccount = await prisma.adAccount.findUnique({
    where: { samAccountName: requester.login },
  });
  if (adAccount?.groups) {
    adGroups = adAccount.groups.split("\n").map(norm).filter(Boolean);
  }

  for (const w of candidates) {
    if (!w.matchService && !w.matchAdGroup) continue; // sans critère : défaut uniquement
    if (w.steps.length === 0) continue;
    const okService =
      !w.matchService || (!!service && norm(service).includes(norm(w.matchService)));
    const okGroup = !w.matchAdGroup || adGroups.includes(norm(w.matchAdGroup));
    if (okService && okGroup) return w;
  }
  return candidates.find((w) => w.isDefault && w.steps.length > 0) ?? null;
}

// ── Étapes & valideurs ─────────────────────────────────────────────────────

async function currentStepOf(request: Request): Promise<WorkflowStep | null> {
  if (!request.workflowId) return null;
  return prisma.workflowStep.findUnique({
    where: {
      workflowId_ordre: {
        workflowId: request.workflowId,
        ordre: request.currentStepOrdre,
      },
    },
  });
}

/** Utilisateurs habilités à valider une étape (désignés nommément ou par rôle). */
export async function stepValidators(step: WorkflowStep): Promise<User[]> {
  const ids = (step.validatorUserIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 0) {
    return prisma.user.findMany({ where: { id: { in: ids }, active: true } });
  }
  if (step.validatorRole) {
    return prisma.user.findMany({
      where: { role: step.validatorRole, active: true },
    });
  }
  return [];
}

/** Demandes en attente dont l'étape courante peut être validée par cet utilisateur. */
export async function pendingRequestsFor(user: User): Promise<Request[]> {
  const pending = await prisma.request.findMany({
    where: { statut: "EN_VALIDATION" },
    orderBy: { createdAt: "asc" },
  });
  if (user.role === "ADMIN") return pending;
  const result: Request[] = [];
  const cache = new Map<string, boolean>();
  for (const request of pending) {
    const key = `${request.workflowId}:${request.currentStepOrdre}`;
    if (!cache.has(key)) {
      const step = await currentStepOf(request);
      const validators = step ? await stepValidators(step) : [];
      cache.set(key, validators.some((v) => v.id === user.id));
    }
    if (cache.get(key)) result.push(request);
  }
  return result;
}

export async function canDecide(request: Request, user: User): Promise<boolean> {
  if (request.statut !== "EN_VALIDATION") return false;
  if (user.role === "ADMIN") return true;
  const step = await currentStepOf(request);
  if (!step) return false;
  const validators = await stepValidators(step);
  return validators.some((v) => v.id === user.id);
}

// ── Création d'une demande ─────────────────────────────────────────────────

export async function createRequest(
  requester: User,
  type: RequestType,
  payload: object,
  agentId?: string,
): Promise<Request> {
  // service de rattachement : celui de la fiche (création) ou de l'agent concerné
  let service = (payload as { service?: string }).service ?? null;
  if (agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    service = agent?.service ?? service;
  }
  const workflow = await selectWorkflow(type, requester, service);

  const request = await prisma.request.create({
    data: {
      type,
      requesterId: requester.id,
      agentId,
      workflowId: workflow?.id,
      payload: payload as never,
      currentStepOrdre: workflow?.steps[0]?.ordre ?? 0,
    },
  });
  await audit("DEMANDE_CREEE", {
    userId: requester.id,
    cible: `Demande n° ${request.numero}`,
    details: `${REQUEST_TYPE_LABELS[type]}${workflow ? ` — circuit « ${workflow.nom} »` : " — sans circuit"}`,
  });

  if (!workflow) {
    // aucun circuit applicable : approbation immédiate
    await approve(request.id);
  } else {
    await notifyStep(request.id, workflow.steps[0]);
  }
  return request;
}

async function notifyStep(requestId: string, step: WorkflowStep): Promise<void> {
  const request = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
    include: { requester: true },
  });
  const validators = await stepValidators(step);
  const emails = validators.map((v) => v.email).filter((e): e is string => !!e);
  const html = await mailLayout(
    `Une demande attend votre validation`,
    [
      `La demande <strong>n° ${request.numero}</strong> — ${REQUEST_TYPE_LABELS[request.type]} — déposée par ${request.requester.displayName} attend votre validation à l'étape « <strong>${step.nom}</strong> ».`,
    ],
    `/demandes/${request.id}`,
    "Examiner la demande",
  );
  await sendMail(emails, `[Sésame] Demande n° ${request.numero} à valider — ${step.nom}`, html);
}

// ── Décision (valider / refuser une étape) ─────────────────────────────────

export async function decide(
  requestId: string,
  user: User,
  decision: Decision,
  commentaire?: string,
): Promise<{ ok: boolean; error?: string }> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, error: "Demande introuvable." };
  if (!(await canDecide(request, user))) {
    return { ok: false, error: "Vous n'êtes pas habilité à valider cette étape." };
  }
  const step = await currentStepOf(request);

  await prisma.requestValidation.create({
    data: {
      requestId,
      stepOrdre: request.currentStepOrdre,
      stepNom: step?.nom ?? "Validation",
      decision,
      userId: user.id,
      commentaire: commentaire || null,
    },
  });
  await audit(decision === "APPROUVE" ? "ETAPE_VALIDEE" : "ETAPE_REFUSEE", {
    userId: user.id,
    cible: `Demande n° ${request.numero}`,
    details: step?.nom,
  });

  if (decision === "REFUSE") {
    await prisma.request.update({
      where: { id: requestId },
      data: { statut: "REFUSEE", closedAt: new Date() },
    });
    await notifyRequester(requestId, "refusée", commentaire);
    return { ok: true };
  }

  const next = request.workflowId
    ? await prisma.workflowStep.findFirst({
        where: {
          workflowId: request.workflowId,
          ordre: { gt: request.currentStepOrdre },
        },
        orderBy: { ordre: "asc" },
      })
    : null;
  if (next) {
    await prisma.request.update({
      where: { id: requestId },
      data: { currentStepOrdre: next.ordre },
    });
    await notifyStep(requestId, next);
  } else {
    await approve(requestId);
  }
  return { ok: true };
}

async function notifyRequester(
  requestId: string,
  etat: string,
  commentaire?: string,
): Promise<void> {
  const request = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
    include: { requester: true },
  });
  if (!request.requester.email) return;
  const lines = [
    `Votre demande <strong>n° ${request.numero}</strong> — ${REQUEST_TYPE_LABELS[request.type]} — a été <strong>${etat}</strong>.`,
  ];
  if (commentaire) lines.push(`Commentaire : « ${commentaire} »`);
  const html = await mailLayout(`Demande ${etat}`, lines, `/demandes/${request.id}`);
  await sendMail(
    [request.requester.email],
    `[Sésame] Demande n° ${request.numero} ${etat}`,
    html,
  );
}

// ── Approbation : effets sur le référentiel + tâches de provisionnement ────

async function approve(requestId: string): Promise<void> {
  const request = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
  const agentId = await applyEffects(request);
  await generateTasks(request);
  await prisma.request.update({
    where: { id: requestId },
    data: { statut: "APPROUVEE", agentId: agentId ?? request.agentId },
  });
  await notifyRequester(requestId, "approuvée");
  // prévenir les techniciens qu'un provisionnement est à faire
  const techs = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIEN", "ADMIN"] }, active: true },
  });
  const html = await mailLayout(
    "Provisionnement à réaliser",
    [
      `La demande <strong>n° ${request.numero}</strong> — ${REQUEST_TYPE_LABELS[request.type]} — est approuvée. La liste des tâches à réaliser est disponible dans Sésame.`,
    ],
    `/demandes/${request.id}`,
    "Voir les tâches",
  );
  await sendMail(
    techs.map((t) => t.email).filter((e): e is string => !!e),
    `[Sésame] Demande n° ${request.numero} approuvée — provisionnement`,
    html,
  );
}

/** Applique la demande au référentiel (agents / accès). Retourne l'agent créé le cas échéant. */
async function applyEffects(request: Request): Promise<string | undefined> {
  if (request.type === "CREATION") {
    const p = request.payload as unknown as CreationPayload;
    const agent = await prisma.agent.create({
      data: {
        civilite: p.civilite,
        nom: p.nom,
        prenom: p.prenom,
        matricule: p.matricule || null,
        email: p.email || null,
        telephone: p.telephone || null,
        statutEmploi: p.statutEmploi,
        direction: p.direction || null,
        service: p.service || null,
        fonction: p.fonction || null,
        site: p.site || null,
        responsable: p.responsable || null,
        teletravail: p.teletravail || null,
        dateArrivee: p.dateArrivee ? new Date(p.dateArrivee) : null,
        dateFinContrat: p.dateFinContrat ? new Date(p.dateFinContrat) : null,
        accesses: {
          create: p.applications.map((a) => ({
            applicationId: a.applicationId,
            profil: a.profil || null,
          })),
        },
      },
    });
    return agent.id;
  }

  if (request.type === "MODIFICATION" && request.agentId) {
    const p = request.payload as unknown as ModificationPayload;
    const c = p.champs ?? {};
    await prisma.agent.update({
      where: { id: request.agentId },
      data: {
        ...(c.email !== undefined && { email: c.email || null }),
        ...(c.telephone !== undefined && { telephone: c.telephone || null }),
        ...(c.statutEmploi && { statutEmploi: c.statutEmploi }),
        ...(c.direction !== undefined && { direction: c.direction || null }),
        ...(c.service !== undefined && { service: c.service || null }),
        ...(c.fonction !== undefined && { fonction: c.fonction || null }),
        ...(c.site !== undefined && { site: c.site || null }),
        ...(c.responsable !== undefined && { responsable: c.responsable || null }),
        ...(c.teletravail !== undefined && { teletravail: c.teletravail || null }),
        ...(c.dateFinContrat !== undefined && {
          dateFinContrat: c.dateFinContrat ? new Date(c.dateFinContrat) : null,
        }),
      },
    });
    for (const a of p.addApplications ?? []) {
      await prisma.agentAccess.create({
        data: {
          agentId: request.agentId,
          applicationId: a.applicationId,
          profil: a.profil || null,
        },
      });
    }
    for (const r of p.removeAccess ?? []) {
      await prisma.agentAccess.updateMany({
        where: { id: r.accessId, statut: "ACTIF" },
        data: { statut: "A_SUPPRIMER" },
      });
    }
    return undefined;
  }

  if (request.type === "DEPART" && request.agentId) {
    const p = request.payload as unknown as DepartPayload;
    await prisma.agent.update({
      where: { id: request.agentId },
      data: { dateDepart: p.dateDepart ? new Date(p.dateDepart) : new Date() },
    });
    await prisma.agentAccess.updateMany({
      where: { agentId: request.agentId, statut: "ACTIF" },
      data: { statut: "A_SUPPRIMER" },
    });
    return undefined;
  }
  return undefined;
}

/** Génère la checklist de provisionnement selon le type de demande. */
async function generateTasks(request: Request): Promise<void> {
  const tasks: { label: string; categorie: string; applicationId?: string }[] = [];

  if (request.type === "CREATION") {
    const p = request.payload as unknown as CreationPayload;
    tasks.push(
      { label: `Créer le compte AD de ${p.prenom} ${p.nom}`, categorie: "AD" },
      { label: "Créer la boîte mail", categorie: "Messagerie" },
      { label: "Faire signer la charte informatique", categorie: "Autre" },
    );
    if (p.teletravail) {
      tasks.push({
        label: `Ouvrir l'accès télétravail (VPN, MFA) — ${p.teletravail}`,
        categorie: "AD",
      });
    }
    for (const a of p.applications ?? []) {
      tasks.push({
        label: `Ouvrir l'accès à ${a.nom}${a.profil ? ` (profil : ${a.profil})` : ""}`,
        categorie: "Application",
        applicationId: a.applicationId,
      });
    }
    for (const e of p.equipements ?? []) {
      tasks.push({ label: `Préparer : ${e}`, categorie: "Matériel" });
    }
  }

  if (request.type === "MODIFICATION") {
    const p = request.payload as unknown as ModificationPayload;
    tasks.push({ label: "Mettre à jour la fiche AD (service, groupes, intitulé)", categorie: "AD" });
    if (p.champs?.teletravail !== undefined) {
      tasks.push({
        label: p.champs.teletravail
          ? `Mettre à jour l'accès télétravail (VPN, MFA) — ${p.champs.teletravail}`
          : "Fermer l'accès télétravail (VPN)",
        categorie: "AD",
      });
    }
    for (const a of p.addApplications ?? []) {
      tasks.push({
        label: `Ouvrir l'accès à ${a.nom}${a.profil ? ` (profil : ${a.profil})` : ""}`,
        categorie: "Application",
        applicationId: a.applicationId,
      });
    }
    for (const r of p.removeAccess ?? []) {
      tasks.push({ label: `Retirer l'accès : ${r.label}`, categorie: "Application" });
    }
  }

  if (request.type === "DEPART") {
    const p = request.payload as unknown as DepartPayload;
    tasks.push(
      { label: "Désactiver le compte AD", categorie: "AD" },
      { label: "Couper ou rediriger la boîte mail", categorie: "Messagerie" },
      { label: "Fermer les accès distants (VPN, MFA)", categorie: "AD" },
      { label: "Récupérer le matériel (poste, téléphone, badge, clés)", categorie: "Matériel" },
    );
    for (const a of p.accesses ?? []) {
      tasks.push({ label: `Retirer l'accès : ${a.label}`, categorie: "Application" });
    }
  }

  if (tasks.length > 0) {
    await prisma.provisionTask.createMany({
      data: tasks.map((t) => ({ ...t, requestId: request.id })),
    });
  }
}

// ── Clôture quand toutes les tâches sont faites ────────────────────────────

export async function checkCompletion(requestId: string): Promise<void> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { tasks: true },
  });
  if (!request || request.statut !== "APPROUVEE") return;
  const allDone =
    request.tasks.length > 0 &&
    request.tasks.every((t) => t.statut === "FAIT" || t.statut === "NON_APPLICABLE");
  if (!allDone) return;

  if (request.type === "DEPART" && request.agentId) {
    await prisma.agent.update({
      where: { id: request.agentId },
      data: { statut: "PARTI" },
    });
    await prisma.agentAccess.updateMany({
      where: { agentId: request.agentId, statut: "A_SUPPRIMER" },
      data: { statut: "SUPPRIME", dateSuppression: new Date() },
    });
  }
  if (request.type === "MODIFICATION" && request.agentId) {
    const p = request.payload as unknown as ModificationPayload;
    for (const r of p.removeAccess ?? []) {
      await prisma.agentAccess.updateMany({
        where: { id: r.accessId, statut: "A_SUPPRIMER" },
        data: { statut: "SUPPRIME", dateSuppression: new Date() },
      });
    }
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { statut: "TERMINEE", closedAt: new Date() },
  });
  await audit("DEMANDE_TERMINEE", { cible: `Demande n° ${request.numero}` });
  await notifyRequester(requestId, "terminée");
}
