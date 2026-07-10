import { prisma } from "./db";
import { getLdapSettings } from "./settings";
import { ldapFindAccount, ldapSearchAccounts } from "./ldap";

/** Compte d'annuaire simplifié, quelle que soit la source (LDAP live ou synchro). */
export type DirectoryAccount = {
  samAccountName: string;
  displayName: string;
  email: string | null;
  ou: string | null;
  enabled: boolean;
};

/** Le compte de service LDAP est-il configuré et le connecteur actif ? */
async function liveLdapConfigured() {
  const cfg = await getLdapSettings();
  if (!cfg?.url || !cfg.baseDn || !cfg.bindDn || !cfg.bindPassword) return null;
  if (cfg.enabled === false) return null;
  return cfg;
}

/**
 * Recherche de comptes dans l'annuaire. Interroge l'AD « à la volée » si le
 * compte de service est configuré ; sinon (ou en cas d'échec réseau) se rabat
 * sur la table `AdAccount` synchronisée.
 */
export async function searchDirectory(
  query: string,
  limit = 10,
): Promise<DirectoryAccount[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cfg = await liveLdapConfigured();
  if (cfg) {
    try {
      const entries = await ldapSearchAccounts(cfg, q, limit);
      return entries.map((e) => ({
        samAccountName: e.samAccountName,
        displayName: e.displayName ?? e.samAccountName,
        email: e.email ?? null,
        ou: e.ou ?? null,
        enabled: e.enabled,
      }));
    } catch (e) {
      console.error("Recherche LDAP live échouée, repli sur l'annuaire synchronisé.", e);
    }
  }

  const rows = await prisma.adAccount.findMany({
    where: {
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { samAccountName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { displayName: "asc" },
    take: limit,
    select: { samAccountName: true, displayName: true, email: true, ou: true, enabled: true },
  });
  return rows.map((r) => ({
    samAccountName: r.samAccountName,
    displayName: r.displayName ?? r.samAccountName,
    email: r.email,
    ou: r.ou,
    enabled: r.enabled,
  }));
}

/**
 * Lit un compte précis par sAMAccountName (LDAP live, repli sur la synchro).
 * Renvoie null si le compte est introuvable dans les deux sources.
 */
export async function findDirectoryAccount(
  samAccountName: string,
): Promise<DirectoryAccount | null> {
  const login = samAccountName.trim();
  if (!login) return null;

  const cfg = await liveLdapConfigured();
  if (cfg) {
    try {
      const e = await ldapFindAccount(cfg, login);
      if (e) {
        return {
          samAccountName: e.samAccountName,
          displayName: e.displayName ?? e.samAccountName,
          email: e.email ?? null,
          ou: e.ou ?? null,
          enabled: e.enabled,
        };
      }
      // trouvé nulle part en live : on tente quand même la synchro ci-dessous
    } catch (e) {
      console.error("Lecture LDAP live échouée, repli sur l'annuaire synchronisé.", e);
    }
  }

  const row = await prisma.adAccount.findFirst({
    where: { samAccountName: { equals: login, mode: "insensitive" } },
    select: { samAccountName: true, displayName: true, email: true, ou: true, enabled: true },
  });
  return row
    ? {
        samAccountName: row.samAccountName,
        displayName: row.displayName ?? row.samAccountName,
        email: row.email,
        ou: row.ou,
        enabled: row.enabled,
      }
    : null;
}
