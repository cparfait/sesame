"use server";

import { redirect } from "next/navigation";
import { authenticate, ensureBootstrapAdmin } from "../auth";
import { getSession } from "../session";

export type FormState = { error?: string; success?: string } | null;

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await ensureBootstrapAdmin();
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(login, password);
  if (!user) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
