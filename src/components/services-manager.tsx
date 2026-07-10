"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import type { RequestType } from "@prisma/client";
import { deleteService, saveService } from "@/lib/actions/services";
import { searchAdGroups } from "@/lib/actions/settings";
import type { AdGroup } from "@/lib/ldap";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import {
  Alert,
  Badge,
  Field,
  Input,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";

export type ServiceDto = {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
  applicationIds: string[];
  adGroups: string | null; // groupes AD rattachés, un par ligne
  workflowCreationId: string | null;
  workflowModificationId: string | null;
  workflowDepartId: string | null;
};

/** Sélecteur multi-groupes AD avec autocomplétion (référentiel AD). */
function AdGroupsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (groups: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const add = (g: string) => {
    const v = g.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setQuery("");
    setResults([]);
    setSearched(false);
  };
  const remove = (g: string) => onChange(value.filter((x) => x !== g));

  const schedule = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const res = await searchAdGroups(q);
      setLoading(false);
      setSearched(true);
      if (res.error) {
        setError(res.error);
        setResults([]);
      } else {
        setResults(res.groups ?? []);
      }
    }, 300);
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((g) => (
            <span
              key={g}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 ring-1 ring-indigo-600/20"
              title={g}
            >
              <span className="truncate">{g.split(",")[0]?.replace(/^CN=/i, "") || g}</span>
              <button
                type="button"
                onClick={() => remove(g)}
                className="shrink-0 rounded-full text-indigo-400 hover:text-indigo-700"
                title="Retirer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            schedule(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            if (!searched) schedule(query);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              add(query);
            }
          }}
          autoComplete="off"
          placeholder="Rechercher un groupe AD (nom ou DN) — Entrée pour ajouter une saisie libre"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
        )}
        {open && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {error ? (
              <p className="px-3 py-2 text-xs text-red-600">{error}</p>
            ) : results.filter((g) => !value.includes(g.dn)).length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                {loading
                  ? "Recherche…"
                  : searched
                    ? "Aucun groupe trouvé."
                    : "Saisissez pour rechercher…"}
              </p>
            ) : (
              results
                .filter((g) => !value.includes(g.dn))
                .map((g) => (
                  <button
                    key={g.dn}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(g.dn)}
                    className="block w-full px-3 py-1.5 text-left hover:bg-indigo-50"
                  >
                    <span className="block text-sm text-slate-800">{g.cn}</span>
                    <span className="block truncate text-xs text-slate-400">{g.dn}</span>
                  </button>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type AppOption = { id: string; nom: string };
type WorkflowOption = { id: string; nom: string; type: RequestType };

const TYPES: RequestType[] = ["CREATION", "MODIFICATION", "DEPART"];

function ServiceEditor({
  service,
  applications,
  workflows,
  onClose,
}: {
  service: ServiceDto | null; // null = nouveau service
  applications: AppOption[];
  workflows: WorkflowOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(service?.nom ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [actif, setActif] = useState(service?.actif ?? true);
  const [appIds, setAppIds] = useState<string[]>(service?.applicationIds ?? []);
  const [adGroups, setAdGroups] = useState<string[]>(
    service?.adGroups ? service.adGroups.split("\n").filter(Boolean) : [],
  );
  const [wf, setWf] = useState({
    CREATION: service?.workflowCreationId ?? "",
    MODIFICATION: service?.workflowModificationId ?? "",
    DEPART: service?.workflowDepartId ?? "",
  });
  const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleApp = (id: string) =>
    setAppIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const save = () =>
    startTransition(async () => {
      const result = await saveService({
        id: service?.id,
        nom,
        description: description || undefined,
        actif,
        applicationIds: appIds,
        adGroups,
        workflowCreationId: wf.CREATION || null,
        workflowModificationId: wf.MODIFICATION || null,
        workflowDepartId: wf.DEPART || null,
      });
      setState(result);
      if (result?.success) {
        router.refresh();
        onClose();
      }
    });

  const remove = () => {
    if (!service) return;
    if (!window.confirm(`Supprimer le service « ${service.nom} » ?`)) return;
    startTransition(async () => {
      await deleteService(service.id);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <Alert state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du service" required>
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Espaces verts"
          />
        </Field>
        <Field label="Description">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="facultatif"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          className="h-4 w-4 accent-indigo-600"
        />
        Actif (proposé à la connexion et dans les demandes)
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Applications métiers rattachées
        </p>
        {applications.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aucune application déclarée dans le référentiel.
          </p>
        ) : (
          <div className="grid max-h-56 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2">
            {applications.map((app) => (
              <label
                key={app.id}
                className="flex items-center gap-2 rounded-md px-1 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={appIds.includes(app.id)}
                  onChange={() => toggleApp(app.id)}
                  className="h-4 w-4 accent-indigo-600"
                />
                {app.nom}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Groupes AD rattachés</p>
        <p className="mb-2 text-xs text-slate-500">
          Facultatif — sert à rattacher ce service à un ou plusieurs groupes Active
          Directory (facilite la gestion et le rapprochement). L&apos;AD n&apos;est pas modifié.
        </p>
        <AdGroupsPicker value={adGroups} onChange={setAdGroups} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Circuits de validation (au plus un par type)
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {TYPES.map((type) => {
            const options = workflows.filter((w) => w.type === type);
            return (
              <Field key={type} label={REQUEST_TYPE_LABELS[type]}>
                <select
                  value={wf[type]}
                  onChange={(e) => setWf((prev) => ({ ...prev, [type]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">— Repli (critères / par défaut)</option>
                  {options.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nom}
                    </option>
                  ))}
                </select>
              </Field>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Sans circuit rattaché, Sésame retombe sur les critères des circuits
          (service / groupe AD) puis sur le circuit par défaut du type.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {service && (
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
        <button onClick={onClose} disabled={pending} className={btnSecondary}>
          Fermer
        </button>
        <button onClick={save} disabled={pending} className={btnPrimary}>
          {pending ? "Enregistrement…" : "Enregistrer le service"}
        </button>
      </div>
    </div>
  );
}

export function ServicesManager({
  services,
  applications,
  workflows,
}: {
  services: ServiceDto[];
  applications: AppOption[];
  workflows: WorkflowOption[];
}) {
  const [openId, setOpenId] = useState<string | null>(null); // id ou "new"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Services
        </h2>
        <button
          onClick={() => setOpenId(openId === "new" ? null : "new")}
          className={btnSecondary}
        >
          <Plus className="h-4 w-4" /> Nouveau service
        </button>
      </div>

      {services.length === 0 && openId !== "new" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Aucun service : les demandes affichent alors toutes les applications et
          la sélection du circuit reste basée sur les critères existants.
        </p>
      )}

      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              onClick={() => setOpenId(openId === s.id ? null : s.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {openId === s.id ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              <span className="flex-1 font-medium">{s.nom}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {!s.actif && (
                  <Badge color="bg-slate-100 text-slate-500 ring-slate-500/20">
                    Inactif
                  </Badge>
                )}
                <Badge>
                  {s.applicationIds.length} appli{s.applicationIds.length > 1 ? "s" : ""}
                </Badge>
                {s.adGroups && (
                  <Badge color="bg-indigo-50 text-indigo-700 ring-indigo-600/20">
                    {s.adGroups.split("\n").filter(Boolean).length} groupe
                    {s.adGroups.split("\n").filter(Boolean).length > 1 ? "s" : ""} AD
                  </Badge>
                )}
              </span>
            </button>
            {openId === s.id && (
              <div className="border-t border-slate-100 p-4">
                <ServiceEditor
                  service={s}
                  applications={applications}
                  workflows={workflows}
                  onClose={() => setOpenId(null)}
                />
              </div>
            )}
          </div>
        ))}
        {openId === "new" && (
          <ServiceEditor
            service={null}
            applications={applications}
            workflows={workflows}
            onClose={() => setOpenId(null)}
          />
        )}
      </div>
    </div>
  );
}
