"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { Role, RequestType } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import { ldapFetchAccounts, ldapSearchGroups, ldapTest, type AdGroup } from "../ldap";
import { mailLayout, sendMail } from "../mail";
import {
  getLdapSettings,
  getSentinelleSettings,
  setSetting,
  type GeneralSettings,
  type LdapSettings,
  type SentinelleSettings,
  type SmtpSettings,
} from "../settings";
import { fetchSentinelleApplications } from "../sentinelle";
import type { FormState } from "./auth";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ── LDAP ───────────────────────────────────────────────────────────────────

async function ldapFromForm(formData: FormData): Promise<LdapSettings> {
  const current = await getLdapSettings();
  const bindPassword = str(formData, "bindPassword");
  const port = str(formData, "port");
  const inactiveDays = Number(str(formData, "inactiveDays"));
  return {
    enabled: formData.get("enabled") === "on",
    url: str(formData, "url"),
    port: port ? Number(port) : undefined,
    useSsl: formData.get("useSsl") === "on",
    caCert: str(formData, "caCert") || undefined,
    baseDn: str(formData, "baseDn"),
    bindDn: str(formData, "bindDn") || undefined,
    // champ laissé vide = conserver le mot de passe déjà enregistré
    bindPassword: bindPassword || current?.bindPassword,
    upnSuffix: str(formData, "upnSuffix") || undefined,
    userDnTemplate: str(formData, "userDnTemplate") || undefined,
    requiredGroup: str(formData, "requiredGroup") || undefined,
    tlsRejectUnauthorized: formData.get("tlsRejectUnauthorized") === "on",
    defaultRole: str(formData, "defaultRole") === "LECTEUR" ? "LECTEUR" : "DEMANDEUR",
    inactiveDays: Number.isFinite(inactiveDays) && inactiveDays > 0 ? inactiveDays : undefined,
  };
}

export async function saveLdap(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const cfg = await ldapFromForm(formData);
  if (!cfg.url || !cfg.baseDn) {
    return { error: "L'URL (ldaps://…) et le DN de base sont obligatoires." };
  }
  await setSetting("ldap", cfg);
  await audit("PARAM_LDAP_MODIFIE", { userId: user.id });
  revalidatePath("/parametres/annuaire");
  return { success: "Paramètres LDAP enregistrés." };
}

export async function testLdap(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  const cfg = await ldapFromForm(formData);
  const result = await ldapTest(cfg);
  return result.ok ? { success: result.message } : { error: result.message };
}

/**
 * Autocomplétion du champ « Groupe AD requis » : recherche des groupes AD par
 * nom. Utilise la configuration LDAP enregistrée (le connecteur doit donc avoir
 * été enregistré au préalable pour disposer du compte de service).
 */
export async function searchAdGroups(
  query: string,
): Promise<{ groups?: AdGroup[]; error?: string }> {
  await requireUser("ADMIN");
  const cfg = await getLdapSettings();
  if (!cfg?.url || !cfg.bindDn || !cfg.bindPassword) {
    return {
      error:
        "Enregistrez d'abord la connexion LDAP (compte de service) pour rechercher les groupes.",
    };
  }
  try {
    return { groups: await ldapSearchGroups(cfg, query) };
  } catch (e) {
    return { error: `Recherche impossible : ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function syncAd(_prev: FormState, _formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN", "TECHNICIEN");
  const cfg = await getLdapSettings();
  if (!cfg?.url) return { error: "Configurez d'abord la connexion LDAP." };
  const start = new Date();
  let accounts;
  try {
    accounts = await ldapFetchAccounts(cfg);
  } catch (e) {
    return { error: `Synchronisation impossible : ${e instanceof Error ? e.message : String(e)}` };
  }
  // Garde-fou : un annuaire vide (groupe mal saisi, filtre trop strict, panne
  // partielle…) retirerait TOUS les comptes de Sésame. On refuse plutôt.
  if (accounts.length === 0) {
    return {
      error:
        "L'annuaire a renvoyé 0 compte — synchronisation annulée pour éviter de vider la liste des comptes de Sésame. Vérifiez le groupe AD et la connexion.",
    };
  }
  for (const a of accounts) {
    await prisma.adAccount.upsert({
      where: { samAccountName: a.samAccountName },
      update: { ...a, syncedAt: new Date() },
      create: { ...a, syncedAt: new Date() },
    });
  }
  // Comptes plus renvoyés par l'AD (disparus ou désormais hors du groupe) : on
  // les retire de Sésame, mais on garde une trace nominative au journal — les
  // actions passées de ces comptes restent ainsi rattachables a posteriori.
  const stale = await prisma.adAccount.findMany({
    where: { syncedAt: { lt: start } },
    select: { samAccountName: true, displayName: true, ou: true },
  });
  for (const s of stale) {
    await audit("AD_COMPTE_RETIRE", {
      userId: user.id,
      cible: s.samAccountName,
      details: [s.displayName, s.ou].filter(Boolean).join(" — ") || undefined,
    });
  }
  const removed = await prisma.adAccount.deleteMany({
    where: { syncedAt: { lt: start } },
  });
  // rapprochement automatique par adresse mail quand elle est unique
  const agents = await prisma.agent.findMany({
    where: { adLogin: null, email: { not: null } },
  });
  let linked = 0;
  for (const agent of agents) {
    const match = await prisma.adAccount.findFirst({
      where: { email: { equals: agent.email!, mode: "insensitive" } },
    });
    if (match) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { adLogin: match.samAccountName },
      });
      linked++;
    }
  }
  await audit("AD_SYNCHRONISE", {
    userId: user.id,
    details: `${accounts.length} comptes, ${removed.count} supprimés, ${linked} rapprochés`,
  });
  revalidatePath("/annuaire");
  return {
    success: `Synchronisation terminée : ${accounts.length} comptes AD (${removed.count} disparus retirés, ${linked} agents rapprochés par email).`,
  };
}

// ── SMTP ───────────────────────────────────────────────────────────────────

export async function saveSmtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const current = await prisma.setting.findUnique({ where: { key: "smtp" } });
  const currentCfg: SmtpSettings | null = current ? JSON.parse(current.value) : null;
  const pass = str(formData, "pass");
  const cfg: SmtpSettings = {
    host: str(formData, "host"),
    port: Number(str(formData, "port") || "587"),
    secure: formData.get("secure") === "on",
    user: str(formData, "user") || undefined,
    pass: pass || currentCfg?.pass,
    from: str(formData, "from"),
  };
  if (!cfg.host || !cfg.from) {
    return { error: "Le serveur SMTP et l'adresse d'expédition sont obligatoires." };
  }
  await setSetting("smtp", cfg);
  await audit("PARAM_SMTP_MODIFIE", { userId: user.id });
  revalidatePath("/parametres/messagerie");
  return { success: "Paramètres SMTP enregistrés." };
}

export async function testSmtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const to = str(formData, "testTo") || user.email || "";
  if (!to) return { error: "Indiquez une adresse de destination pour le test." };
  const html = await mailLayout("Test de configuration", [
    "Si vous recevez ce message, l'envoi de mails depuis Sésame fonctionne correctement. ✔",
  ]);
  const ok = await sendMail([to], "[Sésame] Test d'envoi", html);
  return ok
    ? { success: `Mail de test envoyé à ${to}.` }
    : { error: "Échec de l'envoi — vérifiez les paramètres (voir aussi le journal du serveur)." };
}

// ── Général ────────────────────────────────────────────────────────────────

export async function saveGeneral(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const cfg: GeneralSettings = {
    orgName: str(formData, "orgName") || "Collectivité",
    appUrl: str(formData, "appUrl").replace(/\/$/, ""),
  };
  await setSetting("general", cfg);
  await audit("PARAM_GENERAL_MODIFIE", { userId: user.id });
  revalidatePath("/parametres");
  return { success: "Paramètres enregistrés." };
}

// ── Sentinelle (catalogue d'applications) ──────────────────────────────────

// Construit la config Sentinelle depuis le formulaire. La bascule rapide depuis
// l'en-tête n'envoie pas les champs URL/jeton (repliés) : on retombe alors sur
// les valeurs déjà enregistrées.
async function sentinelleFromForm(formData: FormData): Promise<SentinelleSettings> {
  const current = await getSentinelleSettings();
  const token = str(formData, "token");
  return {
    enabled: formData.get("enabled") === "on",
    url: (str(formData, "url") || current?.url || "").replace(/\/$/, ""),
    token: token || current?.token,
  };
}

export async function saveSentinelle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const cfg = await sentinelleFromForm(formData);
  // l'URL n'est requise que si le connecteur est activé
  if (cfg.enabled && !cfg.url) {
    return { error: "L'URL de Sentinelle est obligatoire pour activer le connecteur." };
  }
  await setSetting("sentinelle", cfg);
  await audit("PARAM_SENTINELLE_MODIFIE", {
    userId: user.id,
    details: cfg.enabled ? "activé" : "désactivé",
  });
  revalidatePath("/parametres/connecteurs");
  return {
    success: `Connecteur Sentinelle ${cfg.enabled ? "activé et enregistré" : "désactivé"}.`,
  };
}

export async function testSentinelle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser("ADMIN");
  const cfg = await sentinelleFromForm(formData);
  if (!cfg.url) {
    return { error: "Renseignez l'URL de Sentinelle avant de tester la connexion." };
  }
  try {
    const apps = await fetchSentinelleApplications(cfg);
    return {
      success: `Connexion réussie : ${apps.length} application(s) trouvée(s) dans le catalogue Sentinelle.`,
    };
  } catch (e) {
    return {
      error: `Échec de la connexion : ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// Aperçu de synchronisation (dry-run) : on calcule ce qui serait fait sans rien
// écrire, l'administrateur valide ensuite en cochant les changements à appliquer.

export type SentinelleDiffItem = {
  externalId: string;
  nom: string;
  description: string | null;
  actif: boolean;
  changes?: string[]; // pour une mise à jour : détail lisible des changements
};

export type SentinelleDeactivateItem = {
  externalId: string;
  nom: string;
};

export type SentinellePreview = {
  created: SentinelleDiffItem[];
  updated: SentinelleDiffItem[];
  deactivated: SentinelleDeactivateItem[];
};

export type SentinelleSelection = {
  create: string[]; // externalId à créer
  update: string[]; // externalId à mettre à jour
  deactivate: string[]; // externalId à désactiver
};

/** Retrouve l'application Sésame correspondant à un asset Sentinelle. */
async function findMatchingApplication(app: { externalId: string; nom: string }) {
  return (
    (await prisma.application.findUnique({ where: { externalId: app.externalId } })) ??
    (await prisma.application.findUnique({ where: { nom: app.nom } }))
  );
}

/** Compare le catalogue Sentinelle à l'état actuel sans rien écrire. */
async function computeSentinelleDiff(
  cfg: SentinelleSettings,
): Promise<SentinellePreview> {
  const apps = await fetchSentinelleApplications(cfg);
  const created: SentinelleDiffItem[] = [];
  const updated: SentinelleDiffItem[] = [];

  for (const app of apps) {
    const existing = await findMatchingApplication(app);
    if (!existing) {
      created.push({
        externalId: app.externalId,
        nom: app.nom,
        description: app.description,
        actif: app.actif,
      });
      continue;
    }
    const changes: string[] = [];
    if (existing.nom !== app.nom) {
      changes.push(`nom : « ${existing.nom} » → « ${app.nom} »`);
    }
    if (existing.actif !== app.actif) {
      changes.push(
        `état : ${existing.actif ? "actif" : "inactif"} → ${app.actif ? "actif" : "inactif"}`,
      );
    }
    if (app.description && app.description !== existing.description) {
      changes.push("description mise à jour");
    }
    if (existing.source !== "sentinelle" || existing.externalId !== app.externalId) {
      changes.push("rattachement au catalogue Sentinelle");
    }
    // on n'affiche que ce qui change réellement
    if (changes.length > 0) {
      updated.push({
        externalId: app.externalId,
        nom: app.nom,
        description: app.description,
        actif: app.actif,
        changes,
      });
    }
  }

  // applications Sentinelle disparues du catalogue → proposées à la désactivation
  const disparues = await prisma.application.findMany({
    where: {
      source: "sentinelle",
      actif: true,
      externalId: { notIn: apps.map((a) => a.externalId) },
    },
    select: { nom: true, externalId: true },
    orderBy: { nom: "asc" },
  });

  return {
    created,
    updated,
    deactivated: disparues
      .filter((d): d is { nom: string; externalId: string } => Boolean(d.externalId))
      .map((d) => ({ externalId: d.externalId, nom: d.nom })),
  };
}

/** Étape 1 : calcule l'aperçu (ajouts / mises à jour / désactivations). */
export async function previewSentinelle(): Promise<{
  preview?: SentinellePreview;
  error?: string;
}> {
  await requireUser("ADMIN", "TECHNICIEN");
  const cfg = await getSentinelleSettings();
  if (cfg?.enabled === false) return { error: "Le connecteur Sentinelle est désactivé." };
  if (!cfg?.url) return { error: "Configurez d'abord l'URL de Sentinelle." };
  try {
    return { preview: await computeSentinelleDiff(cfg) };
  } catch (e) {
    return {
      error: `Connexion à Sentinelle impossible : ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Étape 2 : applique uniquement les changements cochés par l'administrateur. */
export async function applySentinelle(
  selection: SentinelleSelection,
): Promise<FormState> {
  const user = await requireUser("ADMIN", "TECHNICIEN");
  const cfg = await getSentinelleSettings();
  if (cfg?.enabled === false) return { error: "Le connecteur Sentinelle est désactivé." };
  if (!cfg?.url) return { error: "Configurez d'abord l'URL de Sentinelle." };

  let apps;
  try {
    apps = await fetchSentinelleApplications(cfg);
  } catch (e) {
    return {
      error: `Connexion à Sentinelle impossible : ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const createSet = new Set(selection.create);
  const updateSet = new Set(selection.update);
  const deactivateSet = new Set(selection.deactivate);

  let created = 0;
  let updated = 0;
  for (const app of apps) {
    const wantCreate = createSet.has(app.externalId);
    const wantUpdate = updateSet.has(app.externalId);
    if (!wantCreate && !wantUpdate) continue;
    const existing = await findMatchingApplication(app);
    if (existing) {
      if (!wantUpdate) continue; // décoché : on n'applique pas la mise à jour
      await prisma.application.update({
        where: { id: existing.id },
        data: {
          nom: app.nom,
          description: app.description ?? existing.description,
          actif: app.actif,
          source: "sentinelle",
          externalId: app.externalId,
        },
      });
      updated++;
    } else {
      if (!wantCreate) continue;
      await prisma.application.create({
        data: {
          nom: app.nom,
          description: app.description,
          actif: app.actif,
          source: "sentinelle",
          externalId: app.externalId,
        },
      });
      created++;
    }
  }

  // on ne désactive que les applications cochées ET toujours absentes du catalogue
  const presentIds = new Set(apps.map((a) => a.externalId));
  const toDeactivate = [...deactivateSet].filter((id) => !presentIds.has(id));
  let deactivated = 0;
  if (toDeactivate.length > 0) {
    const res = await prisma.application.updateMany({
      where: { source: "sentinelle", actif: true, externalId: { in: toDeactivate } },
      data: { actif: false },
    });
    deactivated = res.count;
  }

  await audit("SENTINELLE_SYNCHRONISE", {
    userId: user.id,
    details: `${created} créées, ${updated} mises à jour, ${deactivated} désactivées (sélection validée)`,
  });
  revalidatePath("/applications");
  return {
    success: `Import appliqué : ${created} créée(s), ${updated} mise(s) à jour, ${deactivated} désactivée(s).`,
  };
}

// ── Circuits de validation ─────────────────────────────────────────────────

export type StepInput = {
  nom: string;
  validatorRole?: string;
  validatorUserIds?: string;
};

export type WorkflowMetaInput = {
  id?: string;
  nom: string;
  type: RequestType;
  actif: boolean;
  isDefault: boolean;
  matchService?: string;
  matchAdGroup?: string;
  priorite: number;
};

/** Crée ou met à jour un circuit (métadonnées + étapes) et retourne son id. */
export async function saveWorkflowDef(
  meta: WorkflowMetaInput,
  steps: StepInput[],
): Promise<FormState & { id?: string }> {
  const user = await requireUser("ADMIN");
  if (!meta.nom.trim()) return { error: "Donnez un nom au circuit." };
  const clean = steps
    .map((s) => ({
      nom: s.nom.trim(),
      validatorRole: (s.validatorRole || undefined) as Role | undefined,
      validatorUserIds: s.validatorUserIds?.trim() || undefined,
    }))
    .filter((s) => s.nom);
  if (clean.length === 0) {
    return { error: "Un circuit doit comporter au moins une étape." };
  }
  for (const s of clean) {
    if (!s.validatorRole && !s.validatorUserIds) {
      return { error: `Étape « ${s.nom} » : choisissez un rôle valideur ou des valideurs nommés.` };
    }
  }

  const data = {
    nom: meta.nom.trim(),
    type: meta.type,
    actif: meta.actif,
    isDefault: meta.isDefault,
    matchService: meta.matchService?.trim() || null,
    matchAdGroup: meta.matchAdGroup?.trim() || null,
    priorite: Number.isFinite(meta.priorite) ? meta.priorite : 0,
  };

  const workflow = meta.id
    ? await prisma.workflow.update({ where: { id: meta.id }, data })
    : await prisma.workflow.create({ data });

  // un seul circuit par défaut par type
  if (data.isDefault) {
    await prisma.workflow.updateMany({
      where: { type: data.type, isDefault: true, NOT: { id: workflow.id } },
      data: { isDefault: false },
    });
  }

  await prisma.$transaction([
    prisma.workflowStep.deleteMany({ where: { workflowId: workflow.id } }),
    prisma.workflowStep.createMany({
      data: clean.map((s, i) => ({
        workflowId: workflow.id,
        ordre: i + 1,
        nom: s.nom,
        validatorRole: s.validatorRole ?? null,
        validatorUserIds: s.validatorUserIds ?? null,
      })),
    }),
  ]);
  await audit("WORKFLOW_MODIFIE", {
    userId: user.id,
    cible: data.nom,
    details: `${data.type} — ${clean.length} étapes`,
  });
  revalidatePath("/parametres/workflows");
  return { success: `Circuit « ${data.nom} » enregistré.`, id: workflow.id };
}

export async function deleteWorkflowDef(id: string): Promise<void> {
  const user = await requireUser("ADMIN");
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return;
  await prisma.workflow.delete({ where: { id } }); // les demandes passées gardent leur historique
  await audit("WORKFLOW_SUPPRIME", { userId: user.id, cible: workflow.nom });
  revalidatePath("/parametres/workflows");
}

// ── Utilisateurs ───────────────────────────────────────────────────────────

export async function setUserRole(userId: string, role: Role): Promise<void> {
  const admin = await requireUser("ADMIN");
  const target = await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit("ROLE_MODIFIE", { userId: admin.id, cible: target.login, details: role });
  revalidatePath("/parametres/utilisateurs");
}

export async function toggleUserActive(userId: string): Promise<void> {
  const admin = await requireUser("ADMIN");
  if (admin.id === userId) return; // on ne se désactive pas soi-même
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;
  await prisma.user.update({
    where: { id: userId },
    data: { active: !target.active },
  });
  await audit(target.active ? "UTILISATEUR_DESACTIVE" : "UTILISATEUR_REACTIVE", {
    userId: admin.id,
    cible: target.login,
  });
  revalidatePath("/parametres/utilisateurs");
}

export async function createLocalUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  const login = str(formData, "login").toLowerCase();
  const displayName = str(formData, "displayName");
  const password = str(formData, "password");
  const role = str(formData, "role") as Role;
  if (!login || !displayName || password.length < 8) {
    return { error: "Identifiant, nom et mot de passe (8 caractères minimum) sont obligatoires." };
  }
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) return { error: "Cet identifiant existe déjà." };
  await prisma.user.create({
    data: {
      login,
      displayName,
      email: str(formData, "email") || null,
      role,
      isLocal: true,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await audit("UTILISATEUR_LOCAL_CREE", { userId: admin.id, cible: login, details: role });
  revalidatePath("/parametres/utilisateurs");
  return { success: `Compte local « ${login} » créé.` };
}

export async function resetLocalPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  const userId = str(formData, "userId");
  const password = str(formData, "password");
  if (password.length < 8) return { error: "8 caractères minimum." };
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target?.isLocal) return { error: "Ce compte n'est pas un compte local." };
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  await audit("MDP_REINITIALISE", { userId: admin.id, cible: target.login });
  return { success: `Mot de passe de « ${target.login} » réinitialisé.` };
}

/**
 * Supprime définitivement un compte local. Refusé pour son propre compte, pour
 * les comptes AD (qui se recréent à la connexion — les désactiver plutôt) et
 * pour les comptes rattachés à des demandes ou validations (on préserve
 * l'historique : désactiver plutôt que supprimer). Les entrées de journal du
 * compte sont conservées mais détachées (userId mis à null).
 */
export async function deleteLocalUser(userId: string): Promise<FormState> {
  const admin = await requireUser("ADMIN");
  if (admin.id === userId) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Compte introuvable." };
  if (!target.isLocal) {
    return {
      error:
        "Seuls les comptes locaux se suppriment. Un compte AD se recrée à la connexion — désactivez-le plutôt.",
    };
  }
  const [requests, validations] = await Promise.all([
    prisma.request.count({ where: { requesterId: userId } }),
    prisma.requestValidation.count({ where: { userId } }),
  ]);
  if (requests > 0 || validations > 0) {
    return {
      error: `Suppression impossible : ce compte est lié à ${requests} demande(s) et ${validations} validation(s). Désactivez-le pour préserver l'historique.`,
    };
  }
  await prisma.user.delete({ where: { id: userId } });
  await audit("UTILISATEUR_LOCAL_SUPPRIME", { userId: admin.id, cible: target.login });
  revalidatePath("/parametres/utilisateurs");
  return { success: `Compte local « ${target.login} » supprimé.` };
}
