"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { RequestType } from "@prisma/client";
import { saveWorkflow, type StepInput } from "@/lib/actions/settings";
import { Alert, Card, btnPrimary, btnSecondary } from "@/components/ui";

type UserOption = { id: string; displayName: string; role: string };
type EditableStep = {
  nom: string;
  mode: "role" | "users";
  validatorRole: string;
  userIds: string[];
};

const ROLES_VALIDEURS = [
  { value: "VALIDATEUR", label: "Tous les valideurs" },
  { value: "TECHNICIEN", label: "Tous les techniciens" },
  { value: "ADMIN", label: "Tous les administrateurs" },
];

export function WorkflowEditor({
  type,
  title,
  initialSteps,
  users,
}: {
  type: RequestType;
  title: string;
  initialSteps: StepInput[];
  users: UserOption[];
}) {
  const [steps, setSteps] = useState<EditableStep[]>(
    initialSteps.map((s) => ({
      nom: s.nom,
      mode: s.validatorUserIds ? "users" : "role",
      validatorRole: s.validatorRole ?? "VALIDATEUR",
      userIds: (s.validatorUserIds ?? "").split(",").filter(Boolean),
    })),
  );
  const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (i: number, patch: Partial<EditableStep>) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const result = await saveWorkflow(
        type,
        steps.map((s) => ({
          nom: s.nom,
          validatorRole: s.mode === "role" ? s.validatorRole : undefined,
          validatorUserIds: s.mode === "users" ? s.userIds.join(",") : undefined,
        })),
      );
      setState(result);
    });

  return (
    <Card title={title}>
      <div className="space-y-3">
        <Alert state={state} />
        {steps.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Aucune étape : les demandes de ce type seront{" "}
            <strong>approuvées immédiatement</strong>, sans validation.
          </p>
        )}
        {steps.map((step, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <input
                value={step.nom}
                onChange={(e) => update(i, { nom: e.target.value })}
                placeholder="Nom de l'étape — ex. Validation chef de service"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === steps.length - 1}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-start gap-4 pl-8">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={step.mode === "role"}
                  onChange={() => update(i, { mode: "role" })}
                  className="accent-indigo-600"
                />
                Par rôle :
                <select
                  value={step.validatorRole}
                  onChange={(e) => update(i, { validatorRole: e.target.value })}
                  disabled={step.mode !== "role"}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm disabled:opacity-40"
                >
                  {ROLES_VALIDEURS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={step.mode === "users"}
                  onChange={() => update(i, { mode: "users" })}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <p>Valideurs nommés :</p>
                  <div className="mt-1 flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
                    {users.map((u) => (
                      <label
                        key={u.id}
                        className={`flex items-center gap-1.5 text-xs ${
                          step.mode !== "users" ? "opacity-40" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={step.mode !== "users"}
                          checked={step.userIds.includes(u.id)}
                          onChange={(e) =>
                            update(i, {
                              userIds: e.target.checked
                                ? [...step.userIds, u.id]
                                : step.userIds.filter((id) => id !== u.id),
                            })
                          }
                          className="accent-indigo-600"
                        />
                        {u.displayName}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-between">
          <button
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                { nom: "", mode: "role", validatorRole: "VALIDATEUR", userIds: [] },
              ])
            }
            className={btnSecondary}
          >
            <Plus className="h-4 w-4" /> Ajouter une étape
          </button>
          <button onClick={save} disabled={pending} className={btnPrimary}>
            {pending ? "Enregistrement…" : "Enregistrer ce circuit"}
          </button>
        </div>
      </div>
    </Card>
  );
}
