import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { ldapAuthenticate } from "./ldap";
import { getLdapSettings } from "./settings";
import { audit } from "./audit";

/**
 * Crée le compte admin local de secours au premier démarrage,
 * si aucun administrateur actif n'existe.
 * Identifiant : admin — mot de passe : SESAME_ADMIN_PASSWORD (défaut « sesame »).
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const count = await prisma.user.count({
    where: { role: "ADMIN", active: true },
  });
  if (count > 0) return;
  const password = process.env.SESAME_ADMIN_PASSWORD ?? "sesame";
  await prisma.user.upsert({
    where: { login: "admin" },
    update: { role: "ADMIN", active: true },
    create: {
      login: "admin",
      displayName: "Administrateur local",
      role: "ADMIN",
      isLocal: true,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}

/**
 * Authentifie sur le compte local s'il existe, sinon via LDAPS.
 * Les utilisateurs AD sont créés à la volée à leur première connexion.
 */
export async function authenticate(
  rawLogin: string,
  password: string,
): Promise<User | null> {
  const login = rawLogin.trim().toLowerCase();
  if (!login || !password) return null;

  const existing = await prisma.user.findUnique({ where: { login } });

  if (existing?.isLocal) {
    if (!existing.active || !existing.passwordHash) return null;
    const ok = await bcrypt.compare(password, existing.passwordHash);
    if (!ok) {
      await audit("CONNEXION_ECHEC", { cible: login });
      return null;
    }
    await audit("CONNEXION", { userId: existing.id });
    return existing;
  }

  const ldap = await getLdapSettings();
  if (!ldap?.url || !ldap?.baseDn) {
    if (!existing) await audit("CONNEXION_ECHEC", { cible: login, details: "LDAP non configuré" });
    return null;
  }

  const info = await ldapAuthenticate(ldap, login, password);
  if (!info) {
    await audit("CONNEXION_ECHEC", { cible: login });
    return null;
  }

  if (existing) {
    if (!existing.active) return null;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { displayName: info.displayName, email: info.email ?? existing.email },
    });
    await audit("CONNEXION", { userId: user.id });
    return user;
  }

  const user = await prisma.user.create({
    data: {
      login,
      displayName: info.displayName,
      email: info.email,
      role: ldap.defaultRole ?? "DEMANDEUR",
      isLocal: false,
    },
  });
  await audit("CONNEXION_PREMIERE", { userId: user.id, cible: login });
  return user;
}
