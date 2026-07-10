"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import type { AppFonction } from "@prisma/client";
import { deleteApplication, saveApplication } from "@/lib/actions/applications";
import { APP_FONCTION_HINTS, APP_FONCTION_LABELS } from "@/lib/constants";
import { Alert, Card, Field, Input, Select, Textarea, btnDanger } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const FONCTIONS: AppFonction[] = [
  "MESSAGERIE",
  "TELEPHONIE",
  "COMPTE_AD",
  "CONTROLE_ACCES",
  "PARC",
  "POSTE",
];

export type ApplicationEditDto = {
  id: string;
  nom: string;
  description: string | null;
  referent: string | null;
  profils: string | null;
  fonction: AppFonction | null;
  actif: boolean;
  accessCount: number;
};

export function ApplicationForm({ app }: { app: ApplicationEditDto | null }) {
  const [state, action] = useActionState(saveApplication, null);
  return (
    <div className="space-y-5">
      <form action={action}>
        <Card>
          <div className="space-y-4">
            <Alert state={state} />
            {app && <input type="hidden" name="id" value={app.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l'application" required>
                <Input
                  name="nom"
                  defaultValue={app?.nom ?? ""}
                  placeholder="ex. CIRIL RH, Berger-Levrault Finances…"
                  required
                />
              </Field>
              <Field label="Référent (fonctionnel ou technique)">
                <Input name="referent" defaultValue={app?.referent ?? ""} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                name="description"
                defaultValue={app?.description ?? ""}
                placeholder="à quoi sert l'application, qui l'utilise…"
              />
            </Field>
            <Field label="Profils d'accès possibles (séparés par des virgules)">
              <Input
                name="profils"
                defaultValue={app?.profils ?? ""}
                placeholder="ex. Consultation, Gestionnaire, Administrateur"
              />
            </Field>
            <Field label="Fonction système (relie les besoins transverses des demandes à cette application)">
              <Select name="fonction" defaultValue={app?.fonction ?? ""}>
                <option value="">— Aucune (application métier classique)</option>
                {FONCTIONS.map((f) => (
                  <option key={f} value={f}>
                    {APP_FONCTION_LABELS[f]}
                  </option>
                ))}
              </Select>
              <span className="mt-1 block text-xs text-slate-500">
                {app?.fonction
                  ? APP_FONCTION_HINTS[app.fonction]
                  : "Ex. « Messagerie » : les tâches de boîte mail seront rattachées à cette application. Une seule application par fonction (elle sera déplacée si déjà attribuée ailleurs)."}
              </span>
            </Field>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="actif"
                defaultChecked={app?.actif ?? true}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              Application active (proposée dans les demandes)
            </label>
            <div className="flex justify-end">
              <SubmitButton>{app ? "Enregistrer" : "Créer l'application"}</SubmitButton>
            </div>
          </div>
        </Card>
      </form>

      {app && (
        <Card title="Zone sensible">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {app.accessCount > 0
                ? `${app.accessCount} accès y sont rattachés : la suppression désactivera l'application au lieu de l'effacer.`
                : "Aucun accès rattaché : la suppression est définitive."}
            </p>
            <button onClick={() => deleteApplication(app.id)} className={btnDanger}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
