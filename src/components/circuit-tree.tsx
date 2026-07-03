import { CircleCheck, CircleDashed, CircleDot, CircleX, Users } from "lucide-react";

export type TreeStep = {
  ordre: number;
  nom: string;
  mode: "SEQUENTIEL" | "PARALLELE";
  requis: number;
  approvals: number;
  validators: string[];
  state: "done" | "current" | "todo" | "refused";
  note?: string;
  comment?: string | null;
};

function StateIcon({ state }: { state: TreeStep["state"] }) {
  if (state === "done") return <CircleCheck className="h-5 w-5 text-emerald-500" />;
  if (state === "refused") return <CircleX className="h-5 w-5 text-red-500" />;
  if (state === "current") return <CircleDot className="h-5 w-5 text-amber-500" />;
  return <CircleDashed className="h-5 w-5 text-slate-300" />;
}

/** Représentation en arbre du circuit : chaque étape se ramifie vers ses valideurs. */
export function CircuitTree({ steps }: { steps: TreeStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Aucune étape — la demande sera approuvée immédiatement au lancement.
      </p>
    );
  }
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const border =
          s.state === "current"
            ? "border-amber-300 bg-amber-50/40"
            : s.state === "done"
              ? "border-emerald-200 bg-emerald-50/30"
              : s.state === "refused"
                ? "border-red-200 bg-red-50/30"
                : "border-slate-200 bg-white";
        return (
          <li key={s.ordre} className="relative pb-4 pl-9 last:pb-0">
            {!last && (
              <span className="absolute left-[9px] top-6 h-full w-px bg-slate-200" aria-hidden />
            )}
            <span className="absolute left-0 top-1">
              <StateIcon state={s.state} />
            </span>
            <div className={`rounded-xl border p-3 ${border}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {s.ordre}. {s.nom}
                </span>
                {s.mode === "PARALLELE" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    <Users className="h-3 w-3" /> parallèle · {s.approvals}/{s.requis}
                  </span>
                )}
              </div>
              {s.validators.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.validators.map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
              {s.note && <p className="mt-1.5 text-xs text-slate-500">{s.note}</p>}
              {s.comment && (
                <p className="mt-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs italic text-slate-500">
                  « {s.comment} »
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
