"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <Alert state={state} />
      <Field label="Identifiant" required>
        <Input
          name="login"
          autoComplete="username"
          autoFocus
          placeholder="prenom.nom"
          required
        />
      </Field>
      <Field label="Mot de passe" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50">
        Se connecter
      </SubmitButton>
    </form>
  );
}
