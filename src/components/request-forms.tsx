"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCreationRequest,
  createDepartRequest,
  createModificationRequest,
  resolveAgentFromAd,
  searchAdAgents,
  type AdAgentOption,
} from "@/lib/actions/requests";
import { CIVILITES, STATUTS_EMPLOI, TELETRAVAIL_OPTIONS } from "@/lib/constants";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type ApplicationDto = { id: string; nom: string; profils: string | null };
export type ServiceDto = { id: string; nom: string; applicationIds: string[] };
export type EquipementDto = { nom: string };
export type AgentDto = {
  id: string;
  nom: string;
  prenom: string;
  service: string | null;
  email: string | null;
  telephone: string | null;
  statutEmploi: string;
  direction: string | null;
  fonction: string | null;
  site: string | null;
  responsable: string | null;
  teletravail: string | null;
  dateFinContrat: string | null;
};
export type AccessDto = { id: string; label: string };

// ── Briques communes ───────────────────────────────────────────────────────

function AppPicker({
  applications,
  legend,
}: {
  applications: ApplicationDto[];
  legend: string;
}) {
  if (applications.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Aucune application n&apos;est encore déclarée dans le référentiel (menu
        « Applications »).
      </p>
    );
  }
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {applications.map((app) => {
          const profils = (app.profils ?? "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          return (
            <div
              key={app.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <input
                type="checkbox"
                name={`app_${app.id}`}
                id={`app_${app.id}`}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              <label htmlFor={`app_${app.id}`} className="flex-1 text-sm font-medium">
                {app.nom}
              </label>
              {profils.length > 0 ? (
                <select
                  name={`profil_${app.id}`}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                >
                  {profils.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={`profil_${app.id}`}
                  placeholder="profil"
                  className="w-24 rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Sélection de l'agent concerné via une recherche dans l'annuaire AD. */
function AgentAdSelect({
  type,
  selected,
}: {
  type: "MODIFICATION" | "DEPART";
  selected: { nom: string; prenom: string } | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdAgentOption[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      startTransition(async () => {
        setResults(await searchAdAgents(q));
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (r: AdAgentOption) => {
    setOpen(false);
    setQuery("");
    setError(null);
    startTransition(async () => {
      const res = await resolveAgentFromAd(r.samAccountName);
      if (res.error || !res.id) {
        setError(res.error ?? "Impossible de rattacher cet agent.");
        return;
      }
      router.push(`/demandes/nouvelle?type=${type}&agentId=${res.id}`);
    });
  };

  if (selected) {
    return (
      <Field label="Agent concerné" required>
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <span className="flex-1 font-medium text-slate-700">
            {selected.nom.toUpperCase()} {selected.prenom}
          </span>
          <button
            type="button"
            onClick={() => router.push(`/demandes/nouvelle?type=${type}`)}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Changer
          </button>
        </div>
      </Field>
    );
  }

  return (
    <Field label="Agent concerné" required>
      <div ref={boxRef} className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Rechercher dans l'annuaire AD…"
        />
        {open && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {pending && <li className="px-3 py-2 text-sm text-slate-400">Recherche…</li>}
            {!pending && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">Aucun compte trouvé.</li>
            )}
            {results.map((r) => (
              <li key={r.samAccountName}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  <span className="font-medium text-slate-700">{r.displayName}</span>
                  <span className="text-xs text-slate-400">
                    {r.samAccountName}
                    {r.ou ? ` · ${r.ou}` : ""}
                    {r.email ? ` · ${r.email}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </Field>
  );
}

// ── Création ───────────────────────────────────────────────────────────────

export function CreationForm({
  applications,
  services,
  equipements,
  defaultService,
}: {
  applications: ApplicationDto[];
  services: ServiceDto[];
  equipements: EquipementDto[];
  defaultService?: string; // service pré-sélectionné (celui du demandeur, modifiable)
}) {
  const [state, action] = useActionState(createCreationRequest, null);
  const [service, setService] = useState(defaultService ?? "");
  const catalog = services.length > 0;
  const selected = services.find((s) => s.nom === service);
  const filteredApps = catalog
    ? applications.filter((a) => selected?.applicationIds.includes(a.id))
    : applications;
  return (
    <form action={action} className="space-y-5">
      <Alert state={state} />

      <Card title="Identité de l'agent">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Civilité">
            <Select name="civilite" defaultValue="">
              <option value="">—</option>
              {CIVILITES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nom" required>
            <Input name="nom" required />
          </Field>
          <Field label="Prénom" required>
            <Input name="prenom" required />
          </Field>
          <Field label="Matricule RH">
            <Input name="matricule" placeholder="si connu" />
          </Field>
          <Field label="Email personnel ou souhaité">
            <Input name="email" type="email" />
          </Field>
          <Field label="Téléphone">
            <Input name="telephone" />
          </Field>
        </div>
      </Card>

      <Card title="Affectation">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Statut d'emploi" required>
            <Select name="statutEmploi" required defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {STATUTS_EMPLOI.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Direction">
            <Input name="direction" placeholder="ex. Direction des services techniques" />
          </Field>
          <Field label="Service" required={catalog}>
            {catalog ? (
              <Select
                name="service"
                required
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                <option value="" disabled>
                  Choisir un service…
                </option>
                {services.map((s) => (
                  <option key={s.id} value={s.nom}>
                    {s.nom}
                  </option>
                ))}
              </Select>
            ) : (
              <Input name="service" placeholder="ex. Espaces verts" />
            )}
          </Field>
          <Field label="Fonction / poste">
            <Input name="fonction" placeholder="ex. Gestionnaire carrière-paie" />
          </Field>
          <Field label="Site / bâtiment">
            <Input name="site" placeholder="ex. Hôtel de ville" />
          </Field>
          <Field label="Responsable hiérarchique">
            <Input name="responsable" />
          </Field>
          <Field label="Date d'arrivée">
            <Input name="dateArrivee" type="date" />
          </Field>
          <Field label="Fin de contrat (si applicable)">
            <Input name="dateFinContrat" type="date" />
          </Field>
          <Field label="Créer sur le modèle de">
            <Input name="copieDe" placeholder="nom d'un agent aux accès similaires" />
          </Field>
        </div>
      </Card>

      <Card title="Télétravail">
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <Field label="Rythme de télétravail">
            <Select name="teletravail" defaultValue="">
              <option value="">Pas de télétravail</option>
              {TELETRAVAIL_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <p className="pb-2 text-xs text-slate-400">
            Si un rythme est choisi, une tâche « ouvrir l&apos;accès télétravail
            (VPN, MFA) » sera ajoutée à la checklist de la DSI.
          </p>
        </div>
      </Card>

      <Card title="Accès aux applications">
        {catalog && !service ? (
          <p className="text-sm text-slate-400">
            Choisissez d&apos;abord un service pour voir les logiciels associés.
          </p>
        ) : (
          <AppPicker applications={filteredApps} legend="Applications à ouvrir" />
        )}
      </Card>

      <Card title="Équipements à prévoir">
        {equipements.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aucun équipement déclaré (menu Paramètres → Équipements).
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {equipements.map((e) => (
              <label
                key={e.nom}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="equipements"
                  value={e.nom}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                {e.nom}
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Field label="Commentaire pour les valideurs et la DSI">
          <Textarea name="commentaire" placeholder="précisions utiles…" />
        </Field>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>Soumettre la demande</SubmitButton>
      </div>
    </form>
  );
}

// ── Modification ───────────────────────────────────────────────────────────

export function ModificationForm({
  applications,
  services,
  agent,
  accesses,
}: {
  applications: ApplicationDto[];
  services: ServiceDto[];
  agent: AgentDto | null;
  accesses: AccessDto[];
}) {
  return (
    <div className="space-y-5">
      <Card>
        <AgentAdSelect
          type="MODIFICATION"
          selected={agent ? { nom: agent.nom, prenom: agent.prenom } : null}
        />
      </Card>

      {agent && (
        <ModificationFields
          key={agent.id}
          agent={agent}
          applications={applications}
          services={services}
          accesses={accesses}
        />
      )}
    </div>
  );
}

function ModificationFields({
  agent,
  applications,
  services,
  accesses,
}: {
  agent: AgentDto;
  applications: ApplicationDto[];
  services: ServiceDto[];
  accesses: AccessDto[];
}) {
  const [state, action] = useActionState(createModificationRequest, null);
  const catalog = services.length > 0;
  const [service, setService] = useState(agent.service ?? "");
  const matched = services.find(
    (s) => s.nom.toLowerCase() === service.trim().toLowerCase(),
  );
  // en modification, on ne bloque jamais : hors catalogue, toutes les applis
  // restent proposées ; si le service correspond, on filtre sur ses logiciels.
  const filteredApps = matched
    ? applications.filter((a) => matched.applicationIds.includes(a.id))
    : applications;
  return (
    <>
        <form action={action} className="space-y-5">
          <Alert state={state} />
          <input type="hidden" name="agentId" value={agent.id} />

          <Card title="Situation — modifiez uniquement ce qui change">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Statut d'emploi">
                <Select name="statutEmploi" defaultValue={agent.statutEmploi}>
                  {STATUTS_EMPLOI.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Direction">
                <Input name="direction" defaultValue={agent.direction ?? ""} />
              </Field>
              <Field label="Service">
                <Input
                  name="service"
                  list={catalog ? "svc-list" : undefined}
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
                {catalog && (
                  <datalist id="svc-list">
                    {services.map((s) => (
                      <option key={s.id} value={s.nom} />
                    ))}
                  </datalist>
                )}
              </Field>
              <Field label="Fonction / poste">
                <Input name="fonction" defaultValue={agent.fonction ?? ""} />
              </Field>
              <Field label="Site / bâtiment">
                <Input name="site" defaultValue={agent.site ?? ""} />
              </Field>
              <Field label="Responsable hiérarchique">
                <Input name="responsable" defaultValue={agent.responsable ?? ""} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={agent.email ?? ""} />
              </Field>
              <Field label="Téléphone">
                <Input name="telephone" defaultValue={agent.telephone ?? ""} />
              </Field>
              <Field label="Fin de contrat">
                <Input
                  name="dateFinContrat"
                  type="date"
                  defaultValue={agent.dateFinContrat ?? ""}
                />
              </Field>
              <Field label="Télétravail">
                <Select name="teletravail" defaultValue={agent.teletravail ?? ""}>
                  <option value="">Pas de télétravail</option>
                  {TELETRAVAIL_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Accès à retirer">
            {accesses.length === 0 ? (
              <p className="text-sm text-slate-400">
                Cet agent n&apos;a aucun accès actif enregistré.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {accesses.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name={`remove_${a.id}`}
                      className="h-4 w-4 rounded border-slate-300 accent-red-600"
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            )}
          </Card>

          <Card title="Accès à ajouter">
            <AppPicker applications={filteredApps} legend="Nouvelles applications" />
            {matched && (
              <p className="mt-2 text-xs text-slate-400">
                Applications proposées pour le service « {matched.nom} ».
              </p>
            )}
          </Card>

          <Card>
            <Field label="Motif / commentaire">
              <Textarea
                name="commentaire"
                placeholder="ex. mobilité interne vers le service urbanisme au 01/09…"
              />
            </Field>
          </Card>

          <div className="flex justify-end">
            <SubmitButton>Soumettre la demande</SubmitButton>
          </div>
        </form>
    </>
  );
}

// ── Départ ─────────────────────────────────────────────────────────────────

const MOTIFS_DEPART = [
  "Mutation",
  "Retraite",
  "Fin de contrat",
  "Démission",
  "Disponibilité",
  "Licenciement",
  "Décès",
  "Autre",
];

export function DepartForm({
  agent,
  accesses,
}: {
  agent: AgentDto | null;
  accesses: AccessDto[];
}) {
  const [state, action] = useActionState(createDepartRequest, null);
  return (
    <div className="space-y-5">
      <Card>
        <AgentAdSelect
          type="DEPART"
          selected={agent ? { nom: agent.nom, prenom: agent.prenom } : null}
        />
      </Card>

      {agent && (
        <form action={action} className="space-y-5">
          <Alert state={state} />
          <input type="hidden" name="agentId" value={agent.id} />

          <Card title="Départ">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date de départ" required>
                <Input name="dateDepart" type="date" required />
              </Field>
              <Field label="Motif">
                <Select name="motif" defaultValue="">
                  <option value="">—</option>
                  {MOTIFS_DEPART.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Accès qui seront supprimés">
            {accesses.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aucun accès applicatif enregistré — le compte AD et la messagerie
                seront tout de même traités.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {accesses.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  >
                    {a.label}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              À l&apos;approbation, une checklist de suppression (AD, messagerie,
              applications, matériel) sera générée pour la DSI.
            </p>
          </Card>

          <Card>
            <Field label="Commentaire">
              <Textarea name="commentaire" />
            </Field>
          </Card>

          <div className="flex justify-end">
            <SubmitButton>Soumettre la demande</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
