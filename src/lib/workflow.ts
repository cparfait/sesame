import type {
  Request,
  RequestStep,
  RequestType,
  Role,
  User,
  Workflow,
  WorkflowStep,
} from "@prisma/client";
import { prisma } from "./db";
import { audit } from "./audit";
import { mailLayout, sendMail } from "./mail";
import { sendMagicActionMail } from "./magic";
import {
  REQUEST_TYPE_LABELS,
  type CircuitStepInput,
  type CreationPayload,
  type DepartPayload,
  type ModificationPayload,
} from "./constants";

const VALID_ROLES: Role[] = [
  "ADMIN",
  "VALIDATEUR",
  "TECHNICIEN",
  "DEMANDEUR",
  "LECTEUR",
];

// ── Sélection du circuit applicable ────────────────────────────────────────

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Choisit le circuit de validation d'une nouvelle demande :
 * 1. le circuit explicitement rattaché au service (catalogue) pour ce type ;
 * 2. sinon, parmi les circuits actifs du type, dans l'ordre de priorité
 *    décroissante, le premier dont TOUS les critères définis correspondent
 *    (service de la demande, groupe AD du demandeur) ;
 * 3. sinon le circuit marqué « par défaut » ;
 * 4. sinon aucun circuit → approbation immédiate.
 */
export async function selectWorkflow(
  type: RequestType,
  requester: User,
  service: string | null | undefined,
): Promise<(Workflow & { steps: WorkflowStep[] }) | null> {
  // 1. Circuit rattaché au service dans le catalogue — prioritaire.
  if (service && service.trim()) {
    const stepsInclude = { include: { steps: { orderBy: { ordre: "asc" as const } } } };
    const svc = await prisma.service.findFirst({
      where: { nom: { equals: service.trim(), mode: "insensitive" }, actif: true },
      include: {
        workflowCreation: stepsInclude,
        workflowModification: stepsInclude,
        workflowDepart: stepsInclude,
      },
    });
    const attached =
      type === "CREATION"
        ? svc?.workflowCreation
        : type === "MODIFICATION"
          ? svc?.workflowModification
          : svc?.workflowDepart;
    if (attached?.actif && attached.steps.length > 0) return attached;
  }

  // 2-4. Repli : critères matchService / matchAdGroup, puis circuit par défaut.
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

// ── Résolution & snapshot du circuit ───────────────────────────────────────

export type ResolvedCircuit = {
  workflowId: string | null;
  workflowNom: string | null;
  steps: CircuitStepInput[];
};

/**
 * Résout le circuit par défaut applicable (pour aperçu au dépôt). Les étapes
 * du modèle sont séquentielles par défaut ; le demandeur peut ensuite les
 * éditer (ajout / retrait / réordonnancement / remplacement / parallèle).
 */
export async function resolveCircuit(
  type: RequestType,
  requester: User,
  service: string | null | undefined,
): Promise<ResolvedCircuit> {
  const wf = await selectWorkflow(type, requester, service);
  if (!wf) return { workflowId: null, workflowNom: null, steps: [] };
  return {
    workflowId: wf.id,
    workflowNom: wf.nom,
    steps: wf.steps.map((s) => ({
      nom: s.nom,
      mode: "SEQUENTIEL",
      requis: 1,
      validatorRole: s.validatorRole ?? null,
      validatorUserIds: s.validatorUserIds ?? undefined,
    })),
  };
}

/** Nettoie/valide des étapes éditées avant de les figer sur la demande. */
function sanitizeSteps(steps: CircuitStepInput[]): CircuitStepInput[] {
  return steps
    .map((s) => {
      const userIds = (s.validatorUserIds ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const role =
        s.validatorRole && VALID_ROLES.includes(s.validatorRole as Role)
          ? (s.validatorRole as Role)
          : null;
      const mode = s.mode === "PARALLELE" ? "PARALLELE" : "SEQUENTIEL";
      // en parallèle, « requis » est borné par le nombre de valideurs nommés
      const requis =
        mode === "PARALLELE"
          ? Math.max(1, Math.min(s.requis || 1, userIds.length || 1))
          : 1;
      return {
        nom: (s.nom ?? "").trim(),
        mode: mode as "SEQUENTIEL" | "PARALLELE",
        requis,
        validatorRole: userIds.length ? null : role,
        validatorUserIds: userIds.length ? userIds.join(",") : undefined,
      };
    })
    .filter((s) => s.nom && (s.validatorRole || s.validatorUserIds));
}

// ── Étapes & valideurs ─────────────────────────────────────────────────────

async function currentStepOf(request: Request): Promise<RequestStep | null> {
  if (!request.currentStepOrdre) return null;
  return prisma.requestStep.findUnique({
    where: {
      requestId_ordre: {
        requestId: request.id,
        ordre: request.currentStepOrdre,
      },
    },
  });
}

const withinWindow = (u: User, now: Date): boolean =>
  (!u.delegateFrom || now >= u.delegateFrom) && (!u.delegateTo || now <= u.delegateTo);

/**
 * Ajoute les délégués actifs des valideurs absents (fenêtre d'absence en cours).
 * Note : comme dans Maarch, on ne vérifie pas récursivement l'absence du délégué.
 */
async function expandDelegations(users: User[]): Promise<User[]> {
  const now = new Date();
  const result = new Map<string, User>(users.map((u) => [u.id, u]));
  for (const u of users) {
    if (u.absent && u.delegateToId && withinWindow(u, now)) {
      const delegate = await prisma.user.findUnique({ where: { id: u.delegateToId } });
      if (delegate?.active) result.set(delegate.id, delegate);
    }
  }
  return [...result.values()];
}

type StepLike = Pick<RequestStep, "validatorRole" | "validatorUserIds">;

/** Utilisateurs habilités à valider une étape (nommés ou par rôle) + délégués. */
export async function stepValidators(step: StepLike): Promise<User[]> {
  const ids = (step.validatorUserIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  let base: User[] = [];
  if (ids.length > 0) {
    base = await prisma.user.findMany({ where: { id: { in: ids }, active: true } });
  } else if (step.validatorRole) {
    base = await prisma.user.findMany({
      where: { role: step.validatorRole, active: true },
    });
  }
  return expandDelegations(base);
}

/** L'utilisateur a-t-il déjà approuvé cette étape (pertinent en parallèle) ? */
async function hasApproved(
  requestId: string,
  ordre: number,
  userId: string,
): Promise<boolean> {
  const v = await prisma.requestValidation.findFirst({
    where: { requestId, stepOrdre: ordre, userId, decision: "APPROUVE" },
  });
  return !!v;
}

/** Demandes en attente dont l'étape courante peut être validée par cet utilisateur. */
export async function pendingRequestsFor(user: User): Promise<Request[]> {
  const pending = await prisma.request.findMany({
    where: { statut: "EN_VALIDATION" },
    orderBy: { createdAt: "asc" },
  });
  const result: Request[] = [];
  for (const request of pending) {
    if (await canDecide(request, user)) result.push(request);
  }
  return result;
}

export async function canDecide(request: Request, user: User): Promise<boolean> {
  if (request.statut !== "EN_VALIDATION") return false;
  const step = await currentStepOf(request);
  if (!step) return false;
  // en parallèle, un valideur qui a déjà voté ne réapparaît pas
  if (step.mode === "PARALLELE" && (await hasApproved(request.id, step.ordre, user.id))) {
    return false;
  }
  if (user.role === "ADMIN") return true;
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

  // circuit par défaut figé (snapshot) sur la demande ; le demandeur pourra
  // l'ajuster puis le lancer depuis la fiche.
  const resolved = await resolveCircuit(type, requester, service);
  const { workflowId, workflowNom } = resolved;
  const steps = sanitizeSteps(resolved.steps);

  const request = await prisma.request.create({
    data: {
      type,
      statut: "BROUILLON", // le circuit est confirmé puis lancé depuis la fiche
      requesterId: requester.id,
      agentId,
      workflowId,
      payload: payload as never,
      currentStepOrdre: steps.length ? 1 : 0,
      steps: {
        create: steps.map((s, i) => ({
          ordre: i + 1,
          nom: s.nom,
          mode: s.mode,
          requis: s.requis,
          validatorRole: (s.validatorRole ?? null) as Role | null,
          validatorUserIds: s.validatorUserIds ?? null,
        })),
      },
    },
    include: { steps: { orderBy: { ordre: "asc" } } },
  });
  await audit("DEMANDE_CREEE", {
    userId: requester.id,
    cible: `Demande n° ${request.numero}`,
    details: `${REQUEST_TYPE_LABELS[type]}${
      steps.length ? ` — circuit « ${workflowNom ?? "personnalisé"} »` : " — sans circuit"
    }`,
  });
  // la demande reste en brouillon : le demandeur confirme le circuit (arbre)
  // puis le lance depuis la fiche — c'est launchRequest qui notifie.
  return request;
}

/** Remplace le circuit figé d'une demande encore en brouillon. */
export async function updateRequestCircuit(
  requestId: string,
  user: User,
  rawSteps: CircuitStepInput[],
): Promise<{ ok: boolean; error?: string }> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, error: "Demande introuvable." };
  if (request.statut !== "BROUILLON") {
    return { ok: false, error: "Le circuit n'est modifiable qu'avant le lancement." };
  }
  if (request.requesterId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "Seul le demandeur peut modifier le circuit." };
  }
  const steps = sanitizeSteps(rawSteps);
  await prisma.$transaction([
    prisma.requestStep.deleteMany({ where: { requestId } }),
    prisma.requestStep.createMany({
      data: steps.map((s, i) => ({
        requestId,
        ordre: i + 1,
        nom: s.nom,
        mode: s.mode,
        requis: s.requis,
        validatorRole: (s.validatorRole ?? null) as Role | null,
        validatorUserIds: s.validatorUserIds ?? null,
      })),
    }),
  ]);
  await prisma.request.update({
    where: { id: requestId },
    data: { currentStepOrdre: steps.length ? 1 : 0 },
  });
  return { ok: true };
}

/** Lance une demande en brouillon dans son circuit (notifie ou approuve). */
export async function launchRequest(
  requestId: string,
  user: User,
  rawSteps?: CircuitStepInput[],
): Promise<{ ok: boolean; error?: string }> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, error: "Demande introuvable." };
  if (request.statut !== "BROUILLON") {
    return { ok: false, error: "Cette demande a déjà été lancée." };
  }
  if (request.requesterId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "Seul le demandeur peut lancer la demande." };
  }
  if (rawSteps) {
    const r = await updateRequestCircuit(requestId, user, rawSteps);
    if (!r.ok) return r;
  }
  const steps = await prisma.requestStep.findMany({
    where: { requestId },
    orderBy: { ordre: "asc" },
  });
  await audit("DEMANDE_LANCEE", {
    userId: user.id,
    cible: `Demande n° ${request.numero}`,
  });
  if (steps.length === 0) {
    // aucun circuit : approbation immédiate
    await approve(requestId);
  } else {
    await prisma.request.update({
      where: { id: requestId },
      data: { statut: "EN_VALIDATION", currentStepOrdre: steps[0].ordre },
    });
    await notifyStep(requestId, steps[0]);
  }
  return { ok: true };
}

async function notifyStep(requestId: string, step: RequestStep): Promise<void> {
  const request = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
    include: { requester: true },
  });
  const validators = await stepValidators(step);
  // un mail individuel par valideur, chacun avec son propre magic link
  for (const v of validators) {
    await sendMagicActionMail(
      v,
      `[Sésame] Demande n° ${request.numero} à valider — ${step.nom}`,
      "Une demande attend votre validation",
      [
        `La demande <strong>n° ${request.numero}</strong> — ${REQUEST_TYPE_LABELS[request.type]} — déposée par ${request.requester.displayName} attend votre validation à l'étape « <strong>${step.nom}</strong> ».`,
      ],
      `/demandes/${request.id}`,
      "Examiner la demande",
    );
  }
}

// ── Décision (valider / refuser / renvoyer une étape) ──────────────────────

export async function decide(
  requestId: string,
  user: User,
  decision: "APPROUVE" | "REFUSE",
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

  // étape parallèle : attendre d'atteindre le nombre de validations requis
  if (step?.mode === "PARALLELE") {
    const approvals = await prisma.requestValidation.findMany({
      where: { requestId, stepOrdre: step.ordre, decision: "APPROUVE" },
      distinct: ["userId"],
      select: { userId: true },
    });
    if (approvals.length < step.requis) return { ok: true }; // encore en attente
  }

  const next = await prisma.requestStep.findFirst({
    where: { requestId, ordre: { gt: request.currentStepOrdre } },
    orderBy: { ordre: "asc" },
  });
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

/** Renvoie la demande à une étape antérieure pour correction (motif obligatoire). */
export async function sendBack(
  requestId: string,
  user: User,
  targetOrdre: number,
  commentaire: string,
): Promise<{ ok: boolean; error?: string }> {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, error: "Demande introuvable." };
  if (!(await canDecide(request, user))) {
    return { ok: false, error: "Vous n'êtes pas habilité sur cette étape." };
  }
  if (!commentaire?.trim()) {
    return { ok: false, error: "Un motif est obligatoire pour un renvoi." };
  }
  if (targetOrdre < 1 || targetOrdre >= request.currentStepOrdre) {
    return { ok: false, error: "L'étape de renvoi doit être antérieure à l'étape courante." };
  }
  const target = await prisma.requestStep.findUnique({
    where: { requestId_ordre: { requestId, ordre: targetOrdre } },
  });
  if (!target) return { ok: false, error: "Étape de renvoi introuvable." };
  const step = await currentStepOf(request);

  await prisma.requestValidation.create({
    data: {
      requestId,
      stepOrdre: request.currentStepOrdre,
      stepNom: step?.nom ?? "Validation",
      decision: "RENVOYE",
      targetOrdre,
      userId: user.id,
      commentaire: commentaire.trim(),
    },
  });
  await prisma.request.update({
    where: { id: requestId },
    data: { currentStepOrdre: targetOrdre },
  });
  await audit("ETAPE_RENVOYEE", {
    userId: user.id,
    cible: `Demande n° ${request.numero}`,
    details: `${step?.nom ?? ""} → ${target.nom}`,
  });
  await notifyStep(requestId, target);
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

  // prévenir individuellement (magic link) les techniciens et les responsables
  // des tâches générées : chacun retrouve ses tâches dans « Mes tâches ».
  const recipients = new Map<string, { id: string; email: string | null }>();
  const techs = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIEN", "ADMIN"] }, active: true },
    select: { id: true, email: true },
  });
  for (const t of techs) recipients.set(t.id, t);
  const taskResps = await prisma.provisionTask.findMany({
    where: { requestId, responsableId: { not: null } },
    select: { responsable: { select: { id: true, email: true, active: true } } },
  });
  for (const t of taskResps) {
    if (t.responsable?.active) recipients.set(t.responsable.id, t.responsable);
  }
  for (const u of recipients.values()) {
    await sendMagicActionMail(
      u,
      `[Sésame] Demande n° ${request.numero} approuvée — provisionnement`,
      "Des tâches vous attendent",
      [
        `La demande <strong>n° ${request.numero}</strong> — ${REQUEST_TYPE_LABELS[request.type]} — est approuvée. Des tâches de provisionnement sont à réaliser.`,
      ],
      "/taches",
      "Voir mes tâches",
    );
  }
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
  const tasks: {
    label: string;
    categorie: string;
    applicationId?: string;
    responsableId?: string;
  }[] = [];

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
    const equipNoms = p.equipements ?? [];
    const equipDefs = equipNoms.length
      ? await prisma.equipement.findMany({
          where: { nom: { in: equipNoms } },
          include: { responsable: { select: { id: true, displayName: true } } },
        })
      : [];
    const respByNom = new Map(equipDefs.map((e) => [e.nom, e.responsable]));
    for (const e of equipNoms) {
      const resp = respByNom.get(e);
      tasks.push({
        label: `Préparer : ${e}${resp ? ` — resp. ${resp.displayName}` : ""}`,
        categorie: "Matériel",
        responsableId: resp?.id,
      });
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
