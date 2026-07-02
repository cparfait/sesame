"use client";

import { useActionState, useTransition } from "react";
import { KeyRound, Power } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  createLocalUser,
  resetLocalPassword,
  setUserRole,
  toggleUserActive,
} from "@/lib/actions/settings";
import { ROLE_LABELS } from "@/lib/constants";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type UserDto = {
  id: string;
  login: string;
  displayName: string;
  email: string | null;
  role: Role;
  isLocal: boolean;
  active: boolean;
};

export function UsersTable({ users, meId }: { users: UserDto[]; meId: string }) {
  const [pending, startTransition] = useTransition();

  const resetPassword = (u: UserDto) => {
    const password = window.prompt(
      `Nouveau mot de passe pour « ${u.login} » (8 caractères minimum) :`,
    );
    if (!password) return;
    const fd = new FormData();
    fd.set("userId", u.id);
    fd.set("password", password);
    startTransition(async () => {
      const result = await resetLocalPassword(null, fd);
      window.alert(result?.success ?? result?.error ?? "");
    });
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${pending ? "opacity-60" : ""}`}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 font-medium">Utilisateur</th>
            <th className="px-4 py-3 font-medium">Identifiant</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Rôle</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id} className={u.active ? "" : "opacity-50"}>
              <td className="px-4 py-3">
                <p className="font-medium">{u.displayName}</p>
                <p className="text-xs text-slate-400">{u.email ?? "—"}</p>
              </td>
              <td className="px-4 py-3">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  {u.login}
                </code>
              </td>
              <td className="px-4 py-3">
                <Badge
                  color={
                    u.isLocal
                      ? "bg-purple-50 text-purple-700 ring-purple-600/20"
                      : "bg-blue-50 text-blue-700 ring-blue-600/20"
                  }
                >
                  {u.isLocal ? "Local" : "AD"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <select
                  value={u.role}
                  disabled={u.id === meId}
                  onChange={(e) =>
                    startTransition(() => setUserRole(u.id, e.target.value as Role))
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  {u.isLocal && (
                    <button
                      onClick={() => resetPassword(u)}
                      title="Réinitialiser le mot de passe"
                      className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}
                  {u.id !== meId && (
                    <button
                      onClick={() => startTransition(() => toggleUserActive(u.id))}
                      title={u.active ? "Désactiver" : "Réactiver"}
                      className={`rounded-md border p-1.5 ${
                        u.active
                          ? "border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreateLocalUserForm() {
  const [state, action] = useActionState(createLocalUser, null);
  return (
    <Card title="Créer un compte local (hors AD)">
      <form action={action} className="space-y-4">
        <Alert state={state} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Identifiant" required>
            <Input name="login" required placeholder="ex. prestataire.rh" />
          </Field>
          <Field label="Nom affiché" required>
            <Input name="displayName" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Field label="Mot de passe (8 caractères min.)" required>
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <Field label="Rôle">
            <Select name="role" defaultValue="DEMANDEUR">
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton>Créer le compte</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
