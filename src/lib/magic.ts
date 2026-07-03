import crypto from "crypto";
import { prisma } from "./db";
import { getSession } from "./session";
import { mailLayout, sendMail } from "./mail";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/** Crée un jeton magic link à usage unique et renvoie le chemin /auth/magic?token=… */
async function magicPath(userId: string, next: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.magicToken.create({
    data: { token, userId, next, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return `/auth/magic?token=${token}`;
}

/**
 * Envoie à un utilisateur un mail d'action contenant un magic link : en cliquant,
 * il est connecté sans mot de passe et redirigé vers `next`.
 */
export async function sendMagicActionMail(
  user: { id: string; email: string | null },
  subject: string,
  title: string,
  lines: string[],
  next: string,
  actionLabel = "Ouvrir dans Sésame",
): Promise<void> {
  if (!user.email) return;
  const path = await magicPath(user.id, next);
  const html = await mailLayout(title, lines, path, actionLabel);
  await sendMail([user.email], subject, html);
}

/**
 * Consomme un jeton (non expiré, non utilisé), ouvre la session et renvoie le
 * chemin de redirection ; null si le jeton est invalide.
 */
export async function consumeMagicToken(token: string): Promise<string | null> {
  const row = await prisma.magicToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.active) {
    return null;
  }
  await prisma.magicToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  const session = await getSession();
  session.userId = row.userId;
  await session.save();

  const next = row.next;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/taches";
}
