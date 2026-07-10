"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useActionState,
  useRef,
  useState,
  useTransition,
} from "react";
import { ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import {
  applySentinelle,
  previewSentinelle,
  saveGeneral,
  saveLdap,
  saveSentinelle,
  saveSmtp,
  searchAdGroups,
  testLdap,
  testSentinelle,
  testSmtp,
  type SentinellePreview,
} from "@/lib/actions/settings";
import type { AdGroup } from "@/lib/ldap";
import { DEFAULT_INACTIVE_DAYS } from "@/lib/constants";
import type {
  GeneralSettings,
  LdapSettings,
  SentinelleSettings,
  SmtpSettings,
} from "@/lib/settings";
import { Alert, Badge, Card, Field, Input, Select, btnPrimary, btnSecondary } from "@/components/ui";
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

/**
 * Champ « Groupe AD requis » avec autocomplétion : recherche les groupes AD via
 * le compte de service (connecteur enregistré) pour éviter les erreurs de saisie
 * du DN. La valeur soumise (`requiredGroup`) est le DN du groupe choisi ; une
 * saisie libre reste possible.
 */
function GroupPicker({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [results, setResults] = useState<AdGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(q: string) {
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
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    setOpen(true);
    schedule(e.target.value);
  }

  function choose(g: AdGroup) {
    setValue(g.dn);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        name="requiredGroup"
        value={value}
        onChange={onChange}
        onFocus={() => {
          setOpen(true);
          if (!searched) schedule(value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        placeholder="Rechercher un groupe (nom ou DN) — vide = tout compte AD valide"
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
      )}
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              {loading
                ? "Recherche…"
                : searched
                  ? "Aucun groupe trouvé."
                  : "Saisissez pour rechercher…"}
            </p>
          ) : (
            results.map((g) => (
              <button
                key={g.dn}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(g)}
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
  );
}

export function LdapForm({ settings }: { settings: LdapSettings | null }) {
  const [saveState, saveAction] = useActionState(saveLdap, null);
  const [testState, testAction] = useActionState(testLdap, null);
  const [useSsl, setUseSsl] = useState(settings?.useSsl ?? false);
  return (
    <form action={saveAction}>
      <Card>
        <div className="space-y-4">
          <Alert state={saveState} />
          <Alert state={testState} />
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={settings?.enabled ?? true}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Authentification LDAP activée (décochez pour n&apos;autoriser que les comptes
            locaux)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serveur LDAP (hôte ou ldaps://…)" required>
              <Input
                name="url"
                defaultValue={settings?.url ?? ""}
                placeholder="dc01.collectivite.local ou ldaps://dc01…:636"
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
            <Field label="Port (laisser vide = valeur par défaut)">
              <Input
                name="port"
                type="number"
                defaultValue={settings?.port ?? ""}
                placeholder={useSsl ? "636 (LDAPS)" : "389 (LDAP)"}
              />
              <label className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="useSsl"
                  checked={useSsl}
                  onChange={(e) => setUseSsl(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                LDAPS — connexion chiffrée (port 636)
              </label>
            </Field>
            <Field label="Certificat CA (chemin du fichier PEM — AC interne)">
              <Input
                name="caCert"
                defaultValue={settings?.caCert ?? ""}
                placeholder="/certs/ca-interne.pem"
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
            <Field label="Gabarit DN utilisateur (jeton {username}, optionnel)">
              <Input
                name="userDnTemplate"
                defaultValue={settings?.userDnTemplate ?? ""}
                placeholder="CN={username},OU=Agents,DC=collectivite,DC=local"
              />
            </Field>
            <div className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Groupe AD requis (connexion réservée à ses membres + annuaire filtré)
              </span>
              <GroupPicker defaultValue={settings?.requiredGroup ?? ""} />
              <span className="mt-1 block text-xs text-slate-500">
                Renseigné, la synchronisation ne conserve que les membres (imbriqués) de
                ce groupe ; les comptes hors du groupe sont retirés de la liste Sésame
                (l&apos;AD n&apos;est jamais modifié) et leur retrait est tracé au journal.
              </span>
            </div>
            <Field label="Rôle attribué aux nouveaux utilisateurs AD">
              <Select name="defaultRole" defaultValue={settings?.defaultRole ?? "DEMANDEUR"}>
                <option value="DEMANDEUR">Demandeur (peut créer des demandes)</option>
                <option value="LECTEUR">Lecteur (consultation seule)</option>
              </Select>
            </Field>
            <Field label="Seuil d'inactivité de l'annuaire (jours)">
              <Input
                name="inactiveDays"
                type="number"
                min={1}
                defaultValue={settings?.inactiveDays ?? DEFAULT_INACTIVE_DAYS}
                placeholder={String(DEFAULT_INACTIVE_DAYS)}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Filtre « Inactifs » de l&apos;annuaire : comptes actifs sans connexion
                (AD) depuis ce nombre de jours. Défaut {DEFAULT_INACTIVE_DAYS} j.
              </span>
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="tlsRejectUnauthorized"
              defaultChecked={settings?.tlsRejectUnauthorized ?? true}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Vérifier le certificat TLS (décochez uniquement si votre AC interne
            n&apos;est pas reconnue — à éviter en production)
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

/**
 * Interrupteur activé/désactivé, toujours visible dans l'en-tête d'un connecteur.
 */
function ToggleSwitch({
  checked,
  onChange,
  name,
}: {
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  name?: string;
}) {
  return (
    <label
      className="relative inline-flex shrink-0 cursor-pointer items-center"
      title={checked ? "Désactiver le connecteur" : "Activer le connecteur"}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}

/**
 * Panneau de connecteur pliable/dépliable. L'en-tête (nom, statut, description,
 * interrupteur) reste toujours visible ; le corps se replie au clic.
 */
function ConnectorPanel({
  name,
  description,
  badge,
  toggle,
  open,
  onOpenChange,
  children,
}: {
  name: string;
  description: string;
  badge: ReactNode;
  toggle: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">{name}</h3>
              {badge}
            </div>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {toggle}
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            aria-label={open ? "Replier" : "Déplier"}
            className="text-slate-400 transition hover:text-slate-600"
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </Card>
  );
}

export function SentinelleForm({
  settings,
}: {
  settings: SentinelleSettings | null;
}) {
  const [saveState, saveAction] = useActionState(saveSentinelle, null);
  const [testState, testAction] = useActionState(testSentinelle, null);
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  // la synchro n'est proposée que si le connecteur est activé ET enregistré
  const savedEnabled = settings?.enabled ?? false;
  const [open, setOpen] = useState(savedEnabled);
  const formRef = useRef<HTMLFormElement>(null);

  // Bascule rapide depuis l'en-tête : on met à jour l'état puis on enregistre
  // immédiatement. On déplie à l'activation pour laisser voir la config / erreurs.
  const handleToggle = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setEnabled(next);
    if (next) setOpen(true);
    formRef.current?.requestSubmit();
  };

  return (
    <div className="space-y-6">
      <form action={saveAction} ref={formRef}>
        <ConnectorPanel
          name="Sentinelle"
          description="Import du catalogue d'applications (inventaire du SI)."
          open={open}
          onOpenChange={setOpen}
          toggle={<ToggleSwitch name="enabled" checked={enabled} onChange={handleToggle} />}
          badge={
            <Badge
              color={
                enabled
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-500 ring-slate-500/20"
              }
            >
              {enabled ? "Activé" : "Désactivé"}
            </Badge>
          }
        >
          <div className="space-y-4">
            <Alert state={saveState} />
            <Alert state={testState} />

            {enabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="URL de Sentinelle" required>
                    <Input
                      name="url"
                      defaultValue={settings?.url ?? ""}
                      placeholder="https://sentinelle.collectivite.fr"
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
              </>
            )}

            {!enabled && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Connecteur désactivé : aucune synchronisation n&apos;est possible.
                Basculez l&apos;interrupteur pour l&apos;activer et le configurer.
              </p>
            )}

            <div className="flex justify-end gap-3">
              <SubmitButton className={btnSecondary} formAction={testAction}>
                Tester la connexion
              </SubmitButton>
              <SubmitButton>Enregistrer</SubmitButton>
            </div>
          </div>

          {savedEnabled && <SentinelleSync />}
        </ConnectorPanel>
      </form>
    </div>
  );
}

/** État coché par catégorie (ensembles d'externalId). */
type SelState = { create: Set<string>; update: Set<string>; deactivate: Set<string> };

/**
 * Synchronisation en deux temps : on demande d'abord un aperçu (dry-run), puis
 * l'administrateur coche les changements à appliquer avant l'import réel.
 */
function SentinelleSync() {
  const [preview, setPreview] = useState<SentinellePreview | null>(null);
  const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
  const [sel, setSel] = useState<SelState>({
    create: new Set(),
    update: new Set(),
    deactivate: new Set(),
  });
  const [pending, startTransition] = useTransition();

  const allFrom = (p: SentinellePreview): SelState => ({
    create: new Set(p.created.map((x) => x.externalId)),
    update: new Set(p.updated.map((x) => x.externalId)),
    deactivate: new Set(p.deactivated.map((x) => x.externalId)),
  });

  const runPreview = () =>
    startTransition(async () => {
      const res = await previewSentinelle();
      if (res.error) {
        setState({ error: res.error });
        setPreview(null);
        return;
      }
      setState(null);
      setPreview(res.preview!);
      setSel(allFrom(res.preview!)); // tout coché par défaut
    });

  const apply = () =>
    startTransition(async () => {
      const res = await applySentinelle({
        create: [...sel.create],
        update: [...sel.update],
        deactivate: [...sel.deactivate],
      });
      setState(res);
      setPreview(null); // l'aperçu est consommé ; relancer pour re-synchroniser
    });

  const toggle = (cat: keyof SelState, id: string) =>
    setSel((prev) => {
      const next = new Set(prev[cat]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [cat]: next };
    });

  const selectedCount = sel.create.size + sel.update.size + sel.deactivate.size;
  const totalCount = preview
    ? preview.created.length + preview.updated.length + preview.deactivated.length
    : 0;

  return (
    <div className="border-t border-slate-200 pt-4">
      <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Synchronisation du catalogue
      </h4>
      <div className="space-y-4">
        <Alert state={state} />

        {!preview && (
          <p className="text-sm text-slate-500">
            La synchronisation calcule d&apos;abord un <strong>aperçu</strong> des
            changements (ajouts, mises à jour, désactivations) sans rien modifier.
            Vous validez ensuite en cochant ce qui doit être appliqué.
          </p>
        )}

        {preview && totalCount === 0 && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Le catalogue Sésame est déjà à jour : aucun changement à appliquer.
          </p>
        )}

        {preview && totalCount > 0 && (
          <div className="space-y-4">
            <DiffSection
              title="Ajouts"
              color="bg-emerald-100 text-emerald-700 ring-emerald-600/20"
              items={preview.created.map((x) => ({
                id: x.externalId,
                nom: x.nom,
                detail: x.actif ? undefined : "sera créée inactive",
              }))}
              checked={sel.create}
              onToggle={(id) => toggle("create", id)}
            />
            <DiffSection
              title="Mises à jour"
              color="bg-amber-100 text-amber-700 ring-amber-600/20"
              items={preview.updated.map((x) => ({
                id: x.externalId,
                nom: x.nom,
                detail: x.changes?.join(" · "),
              }))}
              checked={sel.update}
              onToggle={(id) => toggle("update", id)}
            />
            <DiffSection
              title="Désactivations (retirées du catalogue)"
              color="bg-red-100 text-red-700 ring-red-600/20"
              items={preview.deactivated.map((x) => ({ id: x.externalId, nom: x.nom }))}
              checked={sel.deactivate}
              onToggle={(id) => toggle("deactivate", id)}
            />
            <p className="text-xs text-slate-500">
              Les applications retirées du catalogue sont <strong>désactivées</strong>{" "}
              (jamais supprimées) afin de préserver l&apos;historique des accès.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={runPreview}
            disabled={pending}
            className={btnSecondary}
          >
            {pending && !preview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {preview ? "Rafraîchir l'aperçu" : "Synchroniser maintenant"}
          </button>
          {preview && totalCount > 0 && (
            <button
              type="button"
              onClick={apply}
              disabled={pending || selectedCount === 0}
              className={btnPrimary}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Appliquer la sélection ({selectedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffSection({
  title,
  color,
  items,
  checked,
  onToggle,
}: {
  title: string;
  color: string;
  items: { id: string; nom: string; detail?: string }[];
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <Badge color={color}>{items.length}</Badge>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.map((it) => (
          <li key={it.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={checked.has(it.id)}
                onChange={() => onToggle(it.id)}
                className="mt-0.5 h-4 w-4 accent-indigo-600"
              />
              <span className="flex-1">
                <span className="font-medium text-slate-800">{it.nom}</span>
                {it.detail && (
                  <span className="block text-xs text-slate-500">{it.detail}</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
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
