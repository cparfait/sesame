"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { addAccess, removeAccess, updateAgent } from "@/lib/actions/agents";
import { CIVILITES, STATUTS_EMPLOI } from "@/lib/constants";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type AgentEditDto = {
  id: string;
  civilite: string | null;
  nom: string;
  prenom: string;
  matricule: string | null;
  email: string | null;
  telephone: string | null;
  statutEmploi: string;
  direction: string | null;
  service: string | null;
  fonction: string | null;
  site: string | null;
  responsable: string | null;
  adLogin: string | null;
  dateArrivee: string | null;
  dateFinContrat: string | null;
  commentaire: string | null;
};

export function AgentEditForm({ agent }: { agent: AgentEditDto }) {
  const [state, action] = useActionState(updateAgent, null);
  return (
    <form action={action} className="space-y-5">
      <Alert state={state} />
      <input type="hidden" name="id" value={agent.id} />
      <Card title="Identité">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Civilité">
            <Select name="civilite" defaultValue={agent.civilite ?? ""}>
              <option value="">—</option>
              {CIVILITES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nom" required>
            <Input name="nom" defaultValue={agent.nom} required />
          </Field>
          <Field label="Prénom" required>
            <Input name="prenom" defaultValue={agent.prenom} required />
          </Field>
          <Field label="Matricule RH">
            <Input name="matricule" defaultValue={agent.matricule ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={agent.email ?? ""} />
          </Field>
          <Field label="Téléphone">
            <Input name="telephone" defaultValue={agent.telephone ?? ""} />
          </Field>
          <Field label="Identifiant AD (sAMAccountName)">
            <Input name="adLogin" defaultValue={agent.adLogin ?? ""} placeholder="prenom.nom" />
          </Field>
        </div>
      </Card>
      <Card title="Affectation">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Statut d'emploi" required>
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
          <Field label="Fonction">
            <Input name="fonction" defaultValue={agent.fonction ?? ""} />
          </Field>
          <Field label="Site">
            <Input name="site" defaultValue={agent.site ?? ""} />
          </Field>
          <Field label="Responsable">
            <Input name="responsable" defaultValue={agent.responsable ?? ""} />
          </Field>
          <Field label="Date d'arrivée">
            <Input name="dateArrivee" type="date" defaultValue={agent.dateArrivee ?? ""} />
          </Field>
          <Field label="Fin de contrat">
            <Input
              name="dateFinContrat"
              type="date"
              defaultValue={agent.dateFinContrat ?? ""}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Commentaire interne">
            <Textarea name="commentaire" defaultValue={agent.commentaire ?? ""} />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end">
        <SubmitButton>Enregistrer la fiche</SubmitButton>
      </div>
    </form>
  );
}

export function AccessManager({
  agentId,
  accesses,
  applications,
}: {
  agentId: string;
  accesses: { id: string; label: string; statut: string }[];
  applications: { id: string; nom: string }[];
}) {
  const [state, action] = useActionState(addAccess, null);
  return (
    <Card title="Accès (régularisation directe)">
      <p className="mb-3 text-xs text-slate-400">
        Pour enregistrer l&apos;existant sans passer par une demande. Chaque action est
        tracée dans le journal.
      </p>
      {accesses.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {accesses.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span>{a.label}</span>
              {a.statut !== "SUPPRIME" && (
                <button
                  onClick={() => removeAccess(a.id)}
                  title="Supprimer cet accès"
                  className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="space-y-3">
        <Alert state={state} />
        <input type="hidden" name="agentId" value={agentId} />
        <div className="flex gap-2">
          <Select name="applicationId" defaultValue="" className="flex-1">
            <option value="" disabled>
              Application…
            </option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </Select>
          <Input name="profil" placeholder="profil (optionnel)" className="w-40" />
          <SubmitButton>Ajouter</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
