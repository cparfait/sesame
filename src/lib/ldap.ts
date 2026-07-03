import { Client, type Entry } from "ldapts";
import type { LdapSettings } from "./settings";

function makeClient(cfg: LdapSettings): Client {
  return new Client({
    url: cfg.url,
    timeout: 15000,
    connectTimeout: 10000,
    tlsOptions: { rejectUnauthorized: cfg.tlsRejectUnauthorized },
  });
}

/** Échappe les caractères spéciaux dans un filtre LDAP (RFC 4515). */
function escapeFilter(value: string): string {
  return value.replace(/[\\*()\0]/g, (c) => {
    switch (c) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      default:
        return "\\00";
    }
  });
}

function attr(entry: Entry, name: string): string | undefined {
  const v = entry[name];
  if (v === undefined) return undefined;
  const first = Array.isArray(v) ? v[0] : v;
  if (first === undefined) return undefined;
  return typeof first === "string" ? first : first.toString("utf8");
}

function attrAll(entry: Entry, name: string): string[] {
  const v = entry[name];
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (typeof x === "string" ? x : x.toString("utf8")));
}

/** Timestamp AD (FILETIME, 100 ns depuis 1601) → Date. */
function fileTimeToDate(ft: string | undefined): Date | null {
  if (!ft) return null;
  const n = Number(ft);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n / 10000 - 11644473600000);
}

/** Extrait l'OU lisible depuis un DN : « CN=Jean,OU=DSI,OU=Agents,DC=x » → « Agents / DSI ». */
function ouFromDn(dn: string): string {
  return dn
    .split(",")
    .filter((p) => p.trim().toUpperCase().startsWith("OU="))
    .map((p) => p.trim().slice(3))
    .reverse()
    .join(" / ");
}

function cnFromDn(dn: string): string {
  const first = dn.split(",")[0] ?? dn;
  return first.replace(/^CN=/i, "");
}

export type LdapUserInfo = {
  displayName: string;
  email?: string;
};

/**
 * Authentifie un utilisateur.
 * - Avec compte de service : recherche du DN puis bind avec le mot de passe fourni.
 * - Sans compte de service : bind direct en UPN (login@suffixe).
 */
export async function ldapAuthenticate(
  cfg: LdapSettings,
  login: string,
  password: string,
): Promise<LdapUserInfo | null> {
  if (!password) return null;
  const filter = `(&(objectClass=user)(sAMAccountName=${escapeFilter(login)}))`;
  const attributes = ["displayName", "mail", "sAMAccountName", "cn"];

  if (cfg.bindDn && cfg.bindPassword) {
    const service = makeClient(cfg);
    let entry: Entry | undefined;
    try {
      await service.bind(cfg.bindDn, cfg.bindPassword);
      const { searchEntries } = await service.search(cfg.baseDn, {
        scope: "sub",
        filter,
        attributes,
        sizeLimit: 2,
      });
      entry = searchEntries[0];
    } finally {
      await service.unbind().catch(() => {});
    }
    if (!entry) return null;

    const userClient = makeClient(cfg);
    try {
      await userClient.bind(entry.dn, password);
    } catch {
      return null;
    } finally {
      await userClient.unbind().catch(() => {});
    }
    return {
      displayName: attr(entry, "displayName") ?? attr(entry, "cn") ?? login,
      email: attr(entry, "mail"),
    };
  }

  // Bind direct en UPN
  const upn = cfg.upnSuffix ? `${login}@${cfg.upnSuffix}` : login;
  const client = makeClient(cfg);
  try {
    await client.bind(upn, password);
    let info: LdapUserInfo = { displayName: login };
    try {
      const { searchEntries } = await client.search(cfg.baseDn, {
        scope: "sub",
        filter,
        attributes,
        sizeLimit: 2,
      });
      const entry = searchEntries[0];
      if (entry) {
        info = {
          displayName: attr(entry, "displayName") ?? attr(entry, "cn") ?? login,
          email: attr(entry, "mail"),
        };
      }
    } catch {
      // la lecture peut être refusée : on garde le login comme nom
    }
    return info;
  } catch {
    return null;
  } finally {
    await client.unbind().catch(() => {});
  }
}

/** Teste la connexion avec le compte de service et compte les utilisateurs. */
export async function ldapTest(cfg: LdapSettings): Promise<{ ok: boolean; message: string }> {
  if (!cfg.bindDn || !cfg.bindPassword) {
    return {
      ok: false,
      message:
        "Renseignez un compte de service (DN + mot de passe) pour tester la connexion et synchroniser l'annuaire.",
    };
  }
  const client = makeClient(cfg);
  try {
    await client.bind(cfg.bindDn, cfg.bindPassword);
    const { searchEntries } = await client.search(cfg.baseDn, {
      scope: "sub",
      filter: "(&(objectCategory=person)(objectClass=user))",
      attributes: ["sAMAccountName"],
      paged: { pageSize: 500 },
    });
    return {
      ok: true,
      message: `Connexion réussie — ${searchEntries.length} comptes utilisateurs trouvés dans ${cfg.baseDn}.`,
    };
  } catch (e) {
    return { ok: false, message: `Échec : ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    await client.unbind().catch(() => {});
  }
}

export type AdEntry = {
  samAccountName: string;
  displayName?: string;
  email?: string;
  dn: string;
  ou: string;
  enabled: boolean;
  lastLogon: Date | null;
  groups: string;
  manager: string | null;
};

/** Lit tous les comptes utilisateurs de l'AD (lecture seule). */
export async function ldapFetchAccounts(cfg: LdapSettings): Promise<AdEntry[]> {
  if (!cfg.bindDn || !cfg.bindPassword) {
    throw new Error("Compte de service LDAP non configuré.");
  }
  const client = makeClient(cfg);
  try {
    await client.bind(cfg.bindDn, cfg.bindPassword);
    const { searchEntries } = await client.search(cfg.baseDn, {
      scope: "sub",
      filter: "(&(objectCategory=person)(objectClass=user))",
      attributes: [
        "sAMAccountName",
        "displayName",
        "mail",
        "userAccountControl",
        "memberOf",
        "lastLogonTimestamp",
        "manager",
      ],
      paged: { pageSize: 500 },
    });
    return searchEntries
      .filter((e) => attr(e, "sAMAccountName"))
      .map((e) => {
        const uac = Number(attr(e, "userAccountControl") ?? "0");
        return {
          samAccountName: attr(e, "sAMAccountName")!,
          displayName: attr(e, "displayName"),
          email: attr(e, "mail"),
          dn: e.dn,
          ou: ouFromDn(e.dn),
          enabled: (uac & 2) === 0,
          lastLogon: fileTimeToDate(attr(e, "lastLogonTimestamp")),
          groups: attrAll(e, "memberOf").map(cnFromDn).sort().join("\n"),
          manager: attr(e, "manager") ?? null,
        };
      });
  } finally {
    await client.unbind().catch(() => {});
  }
}
