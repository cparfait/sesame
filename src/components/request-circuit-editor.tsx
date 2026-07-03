"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Rocket, Trash2 } from "lucide-react";
import { launchRequestAction, updateCircuitAction } from "@/lib/actions/requests";
import type { CircuitStepInput } from "@/lib/constants";
import { Alert, btnPrimary, btnSecondary } from "@/components/ui";

export type CircuitUserOption = { id: string; displayName: string };

type EditableStep = {
  nom: string;
  mode: "SEQUENTIEL" | "PARALLELE";
  requis: number;
  useRole: boolean;
  validatorRole: string;
  userIds: string[];
};

const ROLES = [
  { value: "VALIDATEUR", label: "Tous les valideurs" },
  { value: "TECHNICIEN", label: "Tous les techniciens" },
  { value: "ADMIN", label: "Tous les administrateurs" },
];

function toEditable(steps: CircuitStepInput[]): EditableStep[] {
  return steps.map((s) => {
    const userIds = (s.validatorUserIds ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    return {
      nom: s.nom,
      mode: s.mode,
      requis: s.requis || 1,
      useRole: userIds.length === 0,
      validatorRole: s.validatorRole ?? "VALIDATEUR",
      userIds,
    };
  });
}

function serialize(steps: EditableStep[]): CircuitStepInput[] {
  return steps.map((s) => ({
    nom: s.nom,
    mode: s.mode,
    requis: s.requis,
    validatorRole: s.useRole ? s.validatorRole : null,
    validatorUserIds: s.useRole ? "" : s.userIds.join(","),
  }));
}

export function RequestCircuitEditor({
  requestId,
  initialSteps,
  users,
}: {
  requestId: string;
  initialSteps: CircuitStepInput[];
  users: CircuitUserOption[];
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<EditableStep[]>(toEditable(initialSteps));
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

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { nom: "", mode: "SEQUENTIEL", requis: 1, useRole: true, validatorRole: "VALIDATEUR", userIds: [] },
    ]);

  const save = () =>
    startTransition(async () => {
      const result = await updateCircuitAction(requestId, serialize(steps));
      setState(result);
      if (result?.success) router.refresh();
    });

  const launch = () =>
    startTransition(async () => {
      if (!window.confirm("Lancer la demande dans le circuit ? Les valideurs seront notifiés.")) {
        return;
      }
      const result = await launchRequestAction(requestId, serialize(steps));
      setState(result);
      if (result?.success) router.refresh();
    });

  return (
    <div className="space-y-3">
      <Alert state={state} />

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <input
                value={step.nom}
                onChange={(e) => update(i, { nom: e.target.value })}
                placeholder="Nom de l'étape — ex. Validation chef de service"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
              />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 pl-8">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={step.useRole} onChange={() => update(i, { useRole: true })} className="accent-indigo-600" />
                  Par rôle
                </label>
                <select
                  value={step.validatorRole}
                  onChange={(e) => update(i, { validatorRole: e.target.value })}
                  disabled={!step.useRole}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm disabled:opacity-40"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={!step.useRole} onChange={() => update(i, { useRole: false })} className="accent-indigo-600" />
                  Valideurs nommés
                </label>
                <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={step.mode === "PARALLELE"}
                    onChange={(e) => update(i, { mode: e.target.checked ? "PARALLELE" : "SEQUENTIEL" })}
                    className="accent-indigo-600"
                  />
                  Parallèle
                </label>
                {step.mode === "PARALLELE" && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    requis
                    <input
                      type="number"
                      min={1}
                      value={step.requis}
                      onChange={(e) => update(i, { requis: Math.max(1, Number(e.target.value)) })}
                      className="w-14 rounded-md border border-slate-200 px-2 py-1"
                    />
                  </label>
                )}
              </div>

              {!step.useRole && (
                <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
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
              )}
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Aucune étape : au lancement, la demande sera approuvée immédiatement.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={addStep} className={btnSecondary}>
          <Plus className="h-4 w-4" /> Ajouter une étape
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={pending} className={btnSecondary}>
            Enregistrer le circuit
          </button>
          <button type="button" onClick={launch} disabled={pending} className={btnPrimary}>
            <Rocket className="h-4 w-4" /> Lancer le circuit
          </button>
        </div>
      </div>
    </div>
  );
}
