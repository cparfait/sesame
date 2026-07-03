"use client";

import { useActionState, useState } from "react";
import { saveMyDelegation } from "@/lib/actions/delegation";
import { Alert, Card, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type DelegateOption = { id: string; displayName: string };

export function DelegationForm({
  users,
  current,
}: {
  users: DelegateOption[];
  current: {
    absent: boolean;
    delegateToId: string | null;
    delegateFrom: string | null;
    delegateTo: string | null;
  };
}) {
  const [state, action] = useActionState(saveMyDelegation, null);
  const [absent, setAbsent] = useState(current.absent);

  return (
    <Card title="Mon absence et ma délégation">
      <form action={action} className="space-y-4">
        <Alert state={state} />

        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="absent"
            checked={absent}
            onChange={(e) => setAbsent(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          Je suis absent(e) : déléguer mes validations
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Déléguer à" required={absent}>
            <Select name="delegateToId" defaultValue={current.delegateToId ?? ""} disabled={!absent}>
              <option value="">— Choisir un collègue…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="À partir du (facultatif)">
            <input
              type="date"
              name="delegateFrom"
              defaultValue={current.delegateFrom ?? ""}
              disabled={!absent}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
            />
          </Field>
          <Field label="Jusqu'au (facultatif)">
            <input
              type="date"
              name="delegateTo"
              defaultValue={current.delegateTo ?? ""}
              disabled={!absent}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:opacity-60"
            />
          </Field>
        </div>

        <p className="text-xs text-slate-400">
          Sans dates, la délégation s&apos;applique tant que l&apos;absence est
          active. Attention : le délégué n&apos;est pas vérifié absent à son tour.
        </p>

        <div className="flex justify-end">
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
