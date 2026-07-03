import type { User } from "@prisma/client";
import { prisma } from "./db";

/**
 * Ids des agents « sous la responsabilité » d'un utilisateur, d'après l'attribut
 * manager de l'AD : ses subordonnés directs (comptes AD dont il est le manager),
 * rapprochés aux fiches agents par leur login AD (Agent.adLogin).
 */
export async function managedAgentIds(user: User): Promise<string[]> {
  const me = await prisma.adAccount.findUnique({
    where: { samAccountName: user.login },
    select: { dn: true },
  });
  if (!me?.dn) return [];

  const subordinates = await prisma.adAccount.findMany({
    where: { manager: { equals: me.dn, mode: "insensitive" } },
    select: { samAccountName: true },
  });
  const logins = subordinates.map((s) => s.samAccountName);
  if (logins.length === 0) return [];

  const agents = await prisma.agent.findMany({
    where: { adLogin: { in: logins } },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}
