import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { Role, User } from "@prisma/client";

export type SessionData = { userId?: string };

const sessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "sesame-dev-secret-a-changer-en-production-0123456789",
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
  return getIronSession<SessionData>(store, sessionOptions);
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
