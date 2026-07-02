"use client";

import { useTransition } from "react";
import { Check, RotateCcw, SlashSquare } from "lucide-react";
import { setTaskStatut } from "@/lib/actions/requests";
import { fmtDateTime } from "@/lib/constants";

export type TaskDto = {
  id: string;
  label: string;
  categorie: string;
  statut: "A_FAIRE" | "FAIT" | "NON_APPLICABLE";
  doneByName: string | null;
  doneAt: string | null;
};

const CATEGORIES_ORDER = ["AD", "Messagerie", "Application", "Matériel", "Autre"];

export function TaskList({ tasks, canEdit }: { tasks: TaskDto[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const grouped = CATEGORIES_ORDER.map((cat) => ({
    cat,
    items: tasks.filter((t) => t.categorie === cat),
  })).filter((g) => g.items.length > 0);

  const set = (id: string, statut: TaskDto["statut"]) =>
    startTransition(() => setTaskStatut(id, statut));

  return (
    <div className={`space-y-5 ${pending ? "opacity-60" : ""}`}>
      {grouped.map((g) => (
        <div key={g.cat}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {g.cat}
          </p>
          <ul className="space-y-1.5">
            {g.items.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  t.statut === "A_FAIRE"
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    t.statut === "FAIT"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : t.statut === "NON_APPLICABLE"
                        ? "border-slate-300 bg-slate-200 text-slate-500"
                        : "border-slate-300 bg-white"
                  }`}
                >
                  {t.statut === "FAIT" && <Check className="h-3.5 w-3.5" />}
                  {t.statut === "NON_APPLICABLE" && <SlashSquare className="h-3 w-3" />}
                </span>
                <span
                  className={`flex-1 ${
                    t.statut !== "A_FAIRE" ? "text-slate-400 line-through" : ""
                  }`}
                >
                  {t.label}
                </span>
                {t.statut !== "A_FAIRE" && t.doneByName && (
                  <span className="text-xs text-slate-400">
                    {t.doneByName} · {t.doneAt ? fmtDateTime(t.doneAt) : ""}
                  </span>
                )}
                {canEdit &&
                  (t.statut === "A_FAIRE" ? (
                    <span className="flex gap-1">
                      <button
                        onClick={() => set(t.id, "FAIT")}
                        disabled={pending}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-500"
                      >
                        Fait
                      </button>
                      <button
                        onClick={() => set(t.id, "NON_APPLICABLE")}
                        disabled={pending}
                        title="Non applicable"
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                      >
                        N/A
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => set(t.id, "A_FAIRE")}
                      disabled={pending}
                      title="Rouvrir la tâche"
                      className="rounded-md border border-slate-200 p-1 text-slate-400 transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
