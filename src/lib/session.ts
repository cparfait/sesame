import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { Role, User } from "@prisma/client";

export type SessionData = { userId?: string };

const DEV_SESSION_SECRET = "sesame-dev-secret-a-changer-en-production-0123456789";

/**
 * Secret de chiffrement des cookies de session. En production, refuse de
 * retomber sur le secret de développement : un secret par défaut connu (présent
 * dans le code source) permettrait de forger des sessions. Résolu à chaque
 * requête plutôt qu'au chargement du module, pour ne pas faire échouer
 * `next build` quand la variable n'est fournie qu'au runtime.
 */
function resolveSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET absent ou trop court (32 caractères minimum) — " +
        "refus de démarrer en production avec le secret de développement par défaut.",
    );
  }
  return DEV_SESSION_SECRET;
}

const baseSessionOptions = {
  cookieName: "sesame_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "1"
      : process.env.NODE_ENV === "production",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const store = await cookies();
  return getIronSession<SessionData>(store, {
    password: resolveSessionPassword(),
    ...baseSessionOptions,
  });
}

export async function currentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;
  return user;
}

/**
 * Récupère l'utilisateur connecté ou redirige vers /login.
 * Si des rôles sont fournis, vérifie que l'utilisateur en a un (ADMIN passe toujours).
 */
export async function requireUser(...roles: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && user.role !== "ADMIN" && !roles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
