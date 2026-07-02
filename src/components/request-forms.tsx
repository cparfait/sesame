"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createCreationRequest,
  createDepartRequest,
  createModificationRequest,
} from "@/lib/actions/requests";
import { CIVILITES, EQUIPEMENTS, STATUTS_EMPLOI } from "@/lib/constants";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type ApplicationDto = { id: string; nom: string; profils: string | null };
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

function AgentSelect({
  agents,
  type,
  selectedId,
}: {
  agents: AgentDto[];
  type: "MODIFICATION" | "DEPART";
  selectedId?: string;
}) {
  const router = useRouter();
  return (
    <Field label="Agent concerné" required>
      <Select
        value={selectedId ?? ""}
        onChange={(e) =>
          router.push(`/demandes/nouvelle?type=${type}&agentId=${e.target.value}`)
        }
      >
        <option value="" disabled>
          Choisir un agent…
        </option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nom.toUpperCase()} {a.prenom}
            {a.service ? ` — ${a.service}` : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// ── Création ───────────────────────────────────────────────────────────────

export function CreationForm({ applications }: { applications: ApplicationDto[] }) {
  const [state, action] = useActionState(createCreationRequest, null);
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
          <Field label="Service">
            <Input name="service" placeholder="ex. Espaces verts" />
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

      <Card title="Accès aux applications">
        <AppPicker applications={applications} legend="Applications à ouvrir" />
      </Card>

      <Card title="Équipements à prévoir">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPEMENTS.map((e) => (
            <label
              key={e}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="equipements"
                value={e}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              {e}
            </label>
          ))}
        </div>
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
  agents,
  applications,
  agent,
  accesses,
}: {
  agents: AgentDto[];
  applications: ApplicationDto[];
  agent: AgentDto | null;
  accesses: AccessDto[];
}) {
  const [state, action] = useActionState(createModificationRequest, null);
  return (
    <div className="space-y-5">
      <Card>
        <AgentSelect agents={agents} type="MODIFICATION" selectedId={agent?.id} />
      </Card>

      {agent && (
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
                <Input name="service" defaultValue={agent.service ?? ""} />
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
            <AppPicker applications={applications} legend="Nouvelles applications" />
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
      )}
    </div>
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
  agents,
  agent,
  accesses,
}: {
  agents: AgentDto[];
  agent: AgentDto | null;
  accesses: AccessDto[];
}) {
  const [state, action] = useActionState(createDepartRequest, null);
  return (
    <div className="space-y-5">
      <Card>
        <AgentSelect agents={agents} type="DEPART" selectedId={agent?.id} />
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
