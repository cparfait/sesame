"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { Role, RequestType } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../session";
import { audit } from "../audit";
import { ldapFetchAccounts, ldapTest } from "../ldap";
import { mailLayout, sendMail } from "../mail";
import {
  getLdapSettings,
  setSetting,
  type GeneralSettings,
  type LdapSettings,
  type SmtpSettings,
} from "../settings";
import type { FormState } from "./auth";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ── LDAP ───────────────────────────────────────────────────────────────────

async function ldapFromForm(formData: FormData): Promise<LdapSettings> {
  const current = await getLdapSettings();
  const bindPassword = str(formData, "bindPassword");
  return {
    url: str(formData, "url"),
    baseDn: str(formData, "baseDn"),
    bindDn: str(formData, "bindDn") || undefined,
    // champ laissé vide = conserver le mot de passe déjà enregistré
    bindPassword: bindPassword || current?.bindPassword,
    upnSuffix: str(formData, "upnSuffix") || undefined,
    tlsRejectUnauthorized: formData.get("tlsRejectUnauthorized") === "on",
    defaultRole: str(formData, "defaultRole") === "LECTEUR" ? "LECTEUR" : "DEMANDEUR",
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
  for (const a of accounts) {
    await prisma.adAccount.upsert({
      where: { samAccountName: a.samAccountName },
      update: { ...a, syncedAt: new Date() },
      create: { ...a, syncedAt: new Date() },
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

// ── Workflows ──────────────────────────────────────────────────────────────

export type StepInput = {
  nom: string;
  validatorRole?: string;
  validatorUserIds?: string;
};

export async function saveWorkflow(
  type: RequestType,
  steps: StepInput[],
): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const clean = steps
    .map((s) => ({
      nom: s.nom.trim(),
      validatorRole: (s.validatorRole || undefined) as Role | undefined,
      validatorUserIds: s.validatorUserIds?.trim() || undefined,
    }))
    .filter((s) => s.nom);
  for (const s of clean) {
    if (!s.validatorRole && !s.validatorUserIds) {
      return { error: `Étape « ${s.nom} » : choisissez un rôle valideur ou des valideurs nommés.` };
    }
  }
  await prisma.$transaction([
    prisma.workflowStep.deleteMany({ where: { type } }),
    prisma.workflowStep.createMany({
      data: clean.map((s, i) => ({
        type,
        ordre: i + 1,
        nom: s.nom,
        validatorRole: s.validatorRole ?? null,
        validatorUserIds: s.validatorUserIds ?? null,
      })),
    }),
  ]);
  await audit("WORKFLOW_MODIFIE", { userId: user.id, cible: type, details: `${clean.length} étapes` });
  revalidatePath("/parametres/workflows");
  return { success: "Circuit de validation enregistré." };
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
