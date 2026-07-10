import { prisma } from "./db";

export type LdapSettings = {
  enabled?: boolean; // interrupteur ; absent/true = actif (rétrocompat)
  url: string; // hôte simple (dc01.collectivite.local) ou ldaps://dc01…:636
  port?: number; // port explicite (636 LDAPS / 389 LDAP par défaut)
  useSsl?: boolean; // forcer LDAPS même si l'URL n'a pas de schéma
  caCert?: string; // chemin du fichier CA (PEM) pour une AC interne — ou contenu PEM
  baseDn: string; // DC=collectivite,DC=local
  bindDn?: string; // compte de service (lecture seule)
  bindPassword?: string;
  upnSuffix?: string; // collectivite.local — bind utilisateur en login@suffixe
  userDnTemplate?: string; // gabarit DN, ex. « CN={username},OU=Agents,DC=x » ({username})
  requiredGroup?: string; // restriction : seul un membre de ce groupe AD peut se connecter
  tlsRejectUnauthorized: boolean;
  defaultRole: "DEMANDEUR" | "LECTEUR";
  inactiveDays?: number; // seuil du filtre « Inactifs » de l'annuaire (défaut DEFAULT_INACTIVE_DAYS)
};

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string; // "Sésame <sesame@collectivite.fr>"
};

export type SentinelleSettings = {
  enabled?: boolean; // interrupteur du connecteur ; absent/true = actif (rétrocompat)
  url: string; // ex. https://sentinelle.collectivite.fr
  token?: string; // jeton d'API (SESAME_API_TOKEN côté Sentinelle)
};

export type GeneralSettings = {
  orgName: string; // nom de la collectivité
  appUrl: string; // https://sesame.collectivite.fr — utilisé dans les mails
};

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    update: { value: json },
    create: { key, value: json },
  });
}

export const getLdapSettings = () => getSetting<LdapSettings>("ldap");
export const getSmtpSettings = () => getSetting<SmtpSettings>("smtp");
export const getSentinelleSettings = () =>
  getSetting<SentinelleSettings>("sentinelle");
export const getGeneralSettings = async (): Promise<GeneralSettings> =>
  (await getSetting<GeneralSettings>("general")) ?? {
    orgName: "Collectivité",
    appUrl: "",
  };
