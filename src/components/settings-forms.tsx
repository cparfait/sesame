"use client";

import { useActionState } from "react";
import {
  saveGeneral,
  saveLdap,
  saveSentinelle,
  saveSmtp,
  syncSentinelle,
  testLdap,
  testSmtp,
} from "@/lib/actions/settings";
import type {
  GeneralSettings,
  LdapSettings,
  SentinelleSettings,
  SmtpSettings,
} from "@/lib/settings";
import { Alert, Card, Field, Input, Select, btnSecondary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function GeneralForm({ settings }: { settings: GeneralSettings }) {
  const [state, action] = useActionState(saveGeneral, null);
  return (
    <form action={action}>
      <Card>
        <div className="space-y-4">
          <Alert state={state} />
          <Field label="Nom de la collectivité" required>
            <Input
              name="orgName"
              defaultValue={settings.orgName}
              placeholder="ex. Ville de …"
              required
            />
          </Field>
          <Field label="URL publique de Sésame (utilisée dans les liens des mails)">
            <Input
              name="appUrl"
              defaultValue={settings.appUrl}
              placeholder="https://sesame.collectivite.fr"
            />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </div>
      </Card>
    </form>
  );
}

export function LdapForm({ settings }: { settings: LdapSettings | null }) {
  const [saveState, saveAction] = useActionState(saveLdap, null);
  const [testState, testAction] = useActionState(testLdap, null);
  return (
    <form action={saveAction}>
      <Card>
        <div className="space-y-4">
          <Alert state={saveState} />
          <Alert state={testState} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL du contrôleur de domaine" required>
              <Input
                name="url"
                defaultValue={settings?.url ?? ""}
                placeholder="ldaps://dc01.collectivite.local:636"
                required
              />
            </Field>
            <Field label="DN de base" required>
              <Input
                name="baseDn"
                defaultValue={settings?.baseDn ?? ""}
                placeholder="DC=collectivite,DC=local"
                required
              />
            </Field>
            <Field label="Compte de service (DN ou UPN) — lecture seule">
              <Input
                name="bindDn"
                defaultValue={settings?.bindDn ?? ""}
                placeholder="svc-sesame@collectivite.local"
              />
            </Field>
            <Field label="Mot de passe du compte de service">
              <Input
                name="bindPassword"
                type="password"
                placeholder={settings?.bindPassword ? "•••••• (inchangé si vide)" : ""}
              />
            </Field>
            <Field label="Suffixe UPN (connexion sans compte de service)">
              <Input
                name="upnSuffix"
                defaultValue={settings?.upnSuffix ?? ""}
                placeholder="collectivite.local"
              />
            </Field>
            <Field label="Rôle attribué aux nouveaux utilisateurs AD">
              <Select name="defaultRole" defaultValue={settings?.defaultRole ?? "DEMANDEUR"}>
                <option value="DEMANDEUR">Demandeur (peut créer des demandes)</option>
                <option value="LECTEUR">Lecteur (consultation seule)</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="tlsRejectUnauthorized"
              defaultChecked={settings?.tlsRejectUnauthorized ?? true}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Vérifier le certificat TLS (décochez uniquement si votre AC interne n&apos;est
            pas reconnue — à éviter en production)
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            v1 : l&apos;AD est utilisé en <strong>lecture seule</strong> (authentification
            des utilisateurs + synchronisation de l&apos;annuaire). L&apos;écriture
            (création de comptes, groupes) est prévue en v2.
          </p>
          <div className="flex justify-end gap-3">
            <SubmitButton className={btnSecondary} formAction={testAction}>
              Tester la connexion
            </SubmitButton>
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </div>
      </Card>
    </form>
  );
}

export function SentinelleForm({
  settings,
}: {
  settings: SentinelleSettings | null;
}) {
  const [saveState, saveAction] = useActionState(saveSentinelle, null);
  const [syncState, syncAction] = useActionState(syncSentinelle, null);
  return (
    <form action={saveAction}>
      <Card>
        <div className="space-y-4">
          <Alert state={saveState} />
          <Alert state={syncState} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL de Sentinelle" required>
              <Input
                name="url"
                defaultValue={settings?.url ?? ""}
                placeholder="https://sentinelle.collectivite.fr"
                required
              />
            </Field>
            <Field label="Jeton d'API (SESAME_API_TOKEN côté Sentinelle)">
              <Input
                name="token"
                type="password"
                placeholder={settings?.token ? "•••••• (inchangé si vide)" : ""}
              />
            </Field>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Sésame importe le <strong>catalogue d&apos;applications</strong> de
            Sentinelle (modèle « Asset », type application) via{" "}
            <code>GET /api/assets?type=application</code>. Le petit blueprint
            Flask à installer côté Sentinelle est fourni dans{" "}
            <code>docs/sentinelle_api.py</code> du dépôt Sésame. Les applications
            importées sont marquées « Sentinelle » et se mettent à jour à chaque
            synchronisation ; celles retirées du catalogue sont désactivées ici.
          </p>
          <div className="flex justify-end gap-3">
            <SubmitButton className={btnSecondary} formAction={syncAction}>
              Synchroniser maintenant
            </SubmitButton>
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </div>
      </Card>
    </form>
  );
}

export function SmtpForm({ settings }: { settings: SmtpSettings | null }) {
  const [saveState, saveAction] = useActionState(saveSmtp, null);
  const [testState, testAction] = useActionState(testSmtp, null);
  return (
    <form action={saveAction}>
      <Card>
        <div className="space-y-4">
          <Alert state={saveState} />
          <Alert state={testState} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Serveur SMTP" required>
              <Input
                name="host"
                defaultValue={settings?.host ?? ""}
                placeholder="smtp.collectivite.fr"
                required
              />
            </Field>
            <Field label="Port">
              <Input name="port" type="number" defaultValue={settings?.port ?? 587} />
            </Field>
            <Field label="Adresse d'expédition" required>
              <Input
                name="from"
                defaultValue={settings?.from ?? ""}
                placeholder="Sésame <sesame@collectivite.fr>"
                required
              />
            </Field>
            <Field label="Utilisateur (si authentification)">
              <Input name="user" defaultValue={settings?.user ?? ""} />
            </Field>
            <Field label="Mot de passe">
              <Input
                name="pass"
                type="password"
                placeholder={settings?.pass ? "•••••• (inchangé si vide)" : ""}
              />
            </Field>
            <Field label="Adresse pour le mail de test">
              <Input name="testTo" type="email" placeholder="vous@collectivite.fr" />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="secure"
              defaultChecked={settings?.secure ?? false}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Connexion chiffrée implicite (SMTPS, port 465) — sinon STARTTLS
          </label>
          <div className="flex justify-end gap-3">
            <SubmitButton className={btnSecondary} formAction={testAction}>
              Envoyer un mail de test
            </SubmitButton>
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </div>
      </Card>
    </form>
  );
}
