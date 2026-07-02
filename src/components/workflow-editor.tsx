"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import type { RequestType } from "@prisma/client";
import {
  deleteWorkflowDef,
  saveWorkflowDef,
  type StepInput,
} from "@/lib/actions/settings";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import { Alert, Badge, Field, Input, btnPrimary, btnSecondary } from "@/components/ui";

export type WorkflowDto = {
  id: string;
  nom: string;
  type: RequestType;
  actif: boolean;
  isDefault: boolean;
  matchService: string | null;
  matchAdGroup: string | null;
  priorite: number;
  steps: StepInput[];
};

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

const TYPES: RequestType[] = ["CREATION", "MODIFICATION", "DEPART"];

function toEditableSteps(steps: StepInput[]): EditableStep[] {
  return steps.map((s) => ({
    nom: s.nom,
    mode: s.validatorUserIds ? "users" : "role",
    validatorRole: s.validatorRole ?? "VALIDATEUR",
    userIds: (s.validatorUserIds ?? "").split(",").filter(Boolean),
  }));
}

function CircuitEditor({
  circuit,
  type,
  users,
  adGroups,
  onClose,
}: {
  circuit: WorkflowDto | null; // null = nouveau circuit
  type: RequestType;
  users: UserOption[];
  adGroups: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(circuit?.nom ?? "");
  const [actif, setActif] = useState(circuit?.actif ?? true);
  const [isDefault, setIsDefault] = useState(circuit?.isDefault ?? false);
  const [matchService, setMatchService] = useState(circuit?.matchService ?? "");
  const [matchAdGroup, setMatchAdGroup] = useState(circuit?.matchAdGroup ?? "");
  const [priorite, setPriorite] = useState(circuit?.priorite ?? 0);
  const [steps, setSteps] = useState<EditableStep[]>(
    circuit ? toEditableSteps(circuit.steps) : [],
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
      const result = await saveWorkflowDef(
        {
          id: circuit?.id,
          nom,
          type,
          actif,
          isDefault,
          matchService: matchService || undefined,
          matchAdGroup: matchAdGroup || undefined,
          priorite,
        },
        steps.map((s) => ({
          nom: s.nom,
          validatorRole: s.mode === "role" ? s.validatorRole : undefined,
          validatorUserIds: s.mode === "users" ? s.userIds.join(",") : undefined,
        })),
      );
      setState(result);
      if (result?.success) {
        router.refresh();
        onClose();
      }
    });

  const remove = () => {
    if (!circuit) return;
    if (!window.confirm(`Supprimer le circuit « ${circuit.nom} » ?`)) return;
    startTransition(async () => {
      await deleteWorkflowDef(circuit.id);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <Alert state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nom du circuit" required>
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Circuit services techniques"
          />
        </Field>
        <Field label="Critère : service concerné">
          <Input
            value={matchService}
            onChange={(e) => setMatchService(e.target.value)}
            placeholder="ex. Espaces verts (contient)"
          />
        </Field>
        <Field label="Critère : groupe AD du demandeur">
          <Input
            list="ad-groups"
            value={matchAdGroup}
            onChange={(e) => setMatchAdGroup(e.target.value)}
            placeholder="ex. GRP_DST_Demandeurs"
          />
          <datalist id="ad-groups">
            {adGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2 font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          Circuit par défaut (utilisé quand aucun critère ne correspond)
        </label>
        <label className="flex items-center gap-2 font-medium text-slate-700">
          <input
            type="checkbox"
            checked={actif}
            onChange={(e) => setActif(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          Actif
        </label>
        <label className="flex items-center gap-2 font-medium text-slate-700">
          Priorité
          <input
            type="number"
            value={priorite}
            onChange={(e) => setPriorite(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1"
            title="En cas de plusieurs circuits correspondants, le plus prioritaire gagne"
          />
        </label>
      </div>

      <p className="text-xs text-slate-500">
        Si les deux critères sont renseignés, ils doivent correspondre tous les
        deux. Sans aucun critère, cochez « par défaut » pour que le circuit serve
        de repli.
      </p>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
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
      </div>

      <div className="flex flex-wrap justify-between gap-3">
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
        <div className="flex gap-2">
          {circuit && (
            <button onClick={remove} disabled={pending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Supprimer
            </button>
          )}
          <button onClick={onClose} disabled={pending} className={btnSecondary}>
            Fermer
          </button>
          <button onClick={save} disabled={pending} className={btnPrimary}>
            {pending ? "Enregistrement…" : "Enregistrer le circuit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowsManager({
  workflows,
  users,
  adGroups,
}: {
  workflows: WorkflowDto[];
  users: UserOption[];
  adGroups: string[];
}) {
  const [openId, setOpenId] = useState<string | null>(null); // id ou "new:TYPE"

  return (
    <div className="space-y-8">
      {TYPES.map((type) => {
        const circuits = workflows.filter((w) => w.type === type);
        const newKey = `new:${type}`;
        return (
          <section key={type}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {REQUEST_TYPE_LABELS[type]}
              </h2>
              <button
                onClick={() => setOpenId(openId === newKey ? null : newKey)}
                className={btnSecondary}
              >
                <Plus className="h-4 w-4" /> Nouveau circuit
              </button>
            </div>

            {circuits.length === 0 && openId !== newKey && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Aucun circuit : les demandes de ce type sont{" "}
                <strong>approuvées immédiatement</strong>.
              </p>
            )}

            <div className="space-y-2">
              {circuits.map((w) => (
                <div
                  key={w.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    onClick={() => setOpenId(openId === w.id ? null : w.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    {openId === w.id ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="flex-1 font-medium">{w.nom}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {w.isDefault && (
                        <Badge color="bg-indigo-50 text-indigo-700 ring-indigo-600/20">
                          Par défaut
                        </Badge>
                      )}
                      {w.matchService && (
                        <Badge color="bg-blue-50 text-blue-700 ring-blue-600/20">
                          Service : {w.matchService}
                        </Badge>
                      )}
                      {w.matchAdGroup && (
                        <Badge color="bg-purple-50 text-purple-700 ring-purple-600/20">
                          Groupe AD : {w.matchAdGroup}
                        </Badge>
                      )}
                      {!w.actif && (
                        <Badge color="bg-slate-100 text-slate-500 ring-slate-500/20">
                          Inactif
                        </Badge>
                      )}
                      <Badge>
                        {w.steps.length} étape{w.steps.length > 1 ? "s" : ""}
                      </Badge>
                    </span>
                  </button>
                  {openId === w.id && (
                    <div className="border-t border-slate-100 p-4">
                      <CircuitEditor
                        circuit={w}
                        type={type}
                        users={users}
                        adGroups={adGroups}
                        onClose={() => setOpenId(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
              {openId === newKey && (
                <CircuitEditor
                  circuit={null}
                  type={type}
                  users={users}
                  adGroups={adGroups}
                  onClose={() => setOpenId(null)}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
