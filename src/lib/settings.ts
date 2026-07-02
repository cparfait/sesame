import { prisma } from "./db";

export type LdapSettings = {
  url: string; // ldaps://dc01.collectivite.local:636
  baseDn: string; // DC=collectivite,DC=local
  bindDn?: string; // compte de service (lecture seule)
  bindPassword?: string;
  upnSuffix?: string; // collectivite.local — utilisé si pas de compte de service
  tlsRejectUnauthorized: boolean;
  defaultRole: "DEMANDEUR" | "LECTEUR";
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
