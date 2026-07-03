import { notFound, redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canDecide } from "@/lib/workflow";
import { managedAgentIds } from "@/lib/responsibility";
import { cancelRequest } from "@/lib/actions/requests";
import { Badge, Card, PageHeader, btnDanger } from "@/components/ui";
import { DecideBox } from "@/components/decide-box";
import { CircuitTree, type TreeStep } from "@/components/circuit-tree";
import { RequestCircuitEditor } from "@/components/request-circuit-editor";
import { TaskList, type TaskDto } from "@/components/task-list";
import {
  REQUEST_STATUT_COLORS,
  REQUEST_STATUT_LABELS,
  REQUEST_TYPE_LABELS,
  ROLE_LABELS,
  fmtDate,
  fmtDateTime,
  requestObjet,
  type CircuitStepInput,
  type CreationPayload,
  type DepartPayload,
  type ModificationPayload,
} from "@/lib/constants";

const CHAMP_LABELS: Record<string, string> = {
  civilite: "Civilité",
  nom: "Nom",
  prenom: "Prénom",
  matricule: "Matricule RH",
  email: "Email",
  telephone: "Téléphone",
  statutEmploi: "Statut d'emploi",
  direction: "Direction",
  service: "Service",
  fonction: "Fonction",
  site: "Site",
  responsable: "Responsable",
  dateArrivee: "Date d'arrivée",
  dateFinContrat: "Fin de contrat",
  teletravail: "Télétravail",
  copieDe: "Sur le modèle de",
};

function Rows({ rows }: { rows: [string, string | undefined][] }) {
  const filled = rows.filter(([, v]) => v);
  if (filled.length === 0) return <p className="text-sm text-slate-400">—</p>;
  return (
    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
      {filled.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-slate-50 py-1.5 text-sm">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pills({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">Aucun</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
        >
          {i}
        </span>
      ))}
    </div>
  );
}

export default async function DemandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      requester: true,
      agent: true,
      workflow: { select: { nom: true } },
      steps: { orderBy: { ordre: "asc" } },
      validations: { include: { user: true }, orderBy: { createdAt: "asc" } },
      tasks: { include: { doneBy: true }, orderBy: { id: "asc" } },
    },
  });
  if (!request) notFound();
  // un demandeur voit ses demandes + celles concernant les agents sous sa
  // responsabilité (attribut manager de l'AD)
  if (user.role === "DEMANDEUR" && request.requesterId !== user.id) {
    const managed = await managedAgentIds(user);
    if (!request.agentId || !managed.includes(request.agentId)) {
      redirect("/demandes");
    }
  }

  const steps = request.steps;
  const userCanDecide = await canDecide(request, user);
  const currentStep = steps.find((s) => s.ordre === request.currentStepOrdre);
  // étapes antérieures (destinations possibles d'un renvoi)
  const previousSteps = steps
    .filter((s) => s.ordre < request.currentStepOrdre)
    .map((s) => ({ ordre: s.ordre, nom: s.nom }));
  const canCancel =
    ["BROUILLON", "EN_VALIDATION"].includes(request.statut) &&
    (request.requesterId === user.id || user.role === "ADMIN");
  const canEditTasks = ["ADMIN", "TECHNICIEN", "VALIDATEUR"].includes(user.role);

  // circuit en brouillon : le demandeur confirme/modifie puis lance
  const isBrouillon = request.statut === "BROUILLON";
  const canEditCircuit =
    isBrouillon && (request.requesterId === user.id || user.role === "ADMIN");

  // résolution des noms de valideurs pour l'arbre et l'éditeur
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  const userName = new Map(users.map((u) => [u.id, u.displayName]));
  const validatorsOf = (s: (typeof steps)[number]): string[] => {
    const ids = (s.validatorUserIds ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (ids.length) return ids.map((idv) => userName.get(idv) ?? "utilisateur inconnu");
    if (s.validatorRole) return [`${ROLE_LABELS[s.validatorRole]} (par rôle)`];
    return [];
  };
  const treeSteps: TreeStep[] = steps.map((s) => {
    const decided = [...request.validations]
      .reverse()
      .find((v) => v.stepOrdre === s.ordre && v.decision !== "RENVOYE");
    const isCurrent =
      request.statut === "EN_VALIDATION" && s.ordre === request.currentStepOrdre;
    const state: TreeStep["state"] =
      decided?.decision === "APPROUVE"
        ? "done"
        : decided?.decision === "REFUSE"
          ? "refused"
          : isCurrent
            ? "current"
            : "todo";
    return {
      ordre: s.ordre,
      nom: s.nom,
      mode: s.mode,
      requis: s.requis,
      approvals: request.validations.filter(
        (v) => v.stepOrdre === s.ordre && v.decision === "APPROUVE",
      ).length,
      validators: validatorsOf(s),
      state,
      note: decided
        ? `${decided.decision === "APPROUVE" ? "Validée" : "Refusée"} par ${decided.user.displayName} · ${fmtDateTime(decided.createdAt)}`
        : undefined,
      comment: decided?.commentaire ?? null,
    };
  });
  const initialSteps: CircuitStepInput[] = steps.map((s) => ({
    nom: s.nom,
    mode: s.mode,
    requis: s.requis,
    validatorRole: s.validatorRole ?? null,
    validatorUserIds: s.validatorUserIds ?? undefined,
  }));

  const taskDtos: TaskDto[] = request.tasks.map((t) => ({
    id: t.id,
    label: t.label,
    categorie: t.categorie,
    statut: t.statut,
    doneByName: t.doneBy?.displayName ?? null,
    doneAt: t.doneAt?.toISOString() ?? null,
  }));
  const tasksDone = request.tasks.filter((t) => t.statut !== "A_FAIRE").length;

  // ── contenu de la fiche selon le type ──
  let fiche: React.ReactNode = null;
  if (request.type === "CREATION") {
    const p = request.payload as unknown as CreationPayload;
    fiche = (
      <>
        <Card title="Fiche de l'agent">
          <Rows
            rows={Object.entries(CHAMP_LABELS).map(([key, label]) => {
              const v = p[key as keyof CreationPayload];
              const value =
                key.startsWith("date") && typeof v === "string" ? fmtDate(v) : v;
              return [label, typeof value === "string" ? value : undefined];
            })}
          />
        </Card>
        <Card title="Applications demandées">
          <Pills items={(p.applications ?? []).map((a) => `${a.nom}${a.profil ? ` · ${a.profil}` : ""}`)} />
        </Card>
        <Card title="Équipements">
          <Pills items={p.equipements ?? []} />
        </Card>
      </>
    );
  } else if (request.type === "MODIFICATION") {
    const p = request.payload as unknown as ModificationPayload;
    fiche = (
      <>
        <Card title="Champs modifiés">
          <Rows
            rows={Object.entries(p.champs ?? {}).map(([key, value]) => [
              CHAMP_LABELS[key] ?? key,
              key.startsWith("date") && value ? fmtDate(value) : value || "(effacé)",
            ])}
          />
        </Card>
        <Card title="Accès à ajouter">
          <Pills items={(p.addApplications ?? []).map((a) => `${a.nom}${a.profil ? ` · ${a.profil}` : ""}`)} />
        </Card>
        <Card title="Accès à retirer">
          <Pills items={(p.removeAccess ?? []).map((r) => r.label)} />
        </Card>
      </>
    );
  } else {
    const p = request.payload as unknown as DepartPayload;
    fiche = (
      <>
        <Card title="Départ">
          <Rows
            rows={[
              ["Date de départ", fmtDate(p.dateDepart)],
              ["Motif", p.motif],
            ]}
          />
        </Card>
        <Card title="Accès à supprimer">
          <Pills items={(p.accesses ?? []).map((a) => a.label)} />
        </Card>
      </>
    );
  }

  const commentaire = (request.payload as Record<string, unknown>).commentaire;

  return (
    <>
      <PageHeader
        title={`Demande n° ${request.numero} — ${requestObjet(request.type, request.payload)}`}
        subtitle={`${REQUEST_TYPE_LABELS[request.type]} · déposée par ${request.requester.displayName} le ${fmtDateTime(request.createdAt)}`}
      >
        <Badge color={REQUEST_STATUT_COLORS[request.statut]}>
          {REQUEST_STATUT_LABELS[request.statut]}
        </Badge>
        {canCancel && (
          <form action={cancelRequest.bind(null, request.id)}>
            <button type="submit" className={btnDanger}>
              <Ban className="h-4 w-4" /> Annuler
            </button>
          </form>
        )}
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {fiche}
          {typeof commentaire === "string" && commentaire && (
            <Card title="Commentaire du demandeur">
              <p className="whitespace-pre-wrap text-sm text-slate-600">{commentaire}</p>
            </Card>
          )}

          {(request.statut === "APPROUVEE" || request.statut === "TERMINEE") && (
            <Card
              title={`Provisionnement — ${tasksDone}/${request.tasks.length} tâches`}
            >
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${request.tasks.length ? (tasksDone / request.tasks.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <TaskList tasks={taskDtos} canEdit={canEditTasks && request.statut === "APPROUVEE"} />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card
            title={
              request.workflow
                ? `Circuit — ${request.workflow.nom}`
                : "Circuit de validation"
            }
          >
            {isBrouillon && (
              <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Circuit par défaut proposé. Ajustez-le si besoin, puis lancez la
                demande — les valideurs seront alors notifiés.
              </p>
            )}
            <CircuitTree steps={treeSteps} />
            {canEditCircuit && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <RequestCircuitEditor
                  requestId={request.id}
                  initialSteps={initialSteps}
                  users={users}
                />
              </div>
            )}
          </Card>

          {userCanDecide && currentStep && (
            <DecideBox
              requestId={request.id}
              stepNom={currentStep.nom}
              previousSteps={previousSteps}
            />
          )}
          {userCanDecide && !currentStep && request.statut === "EN_VALIDATION" && (
            <DecideBox requestId={request.id} stepNom="Validation" previousSteps={[]} />
          )}
        </div>
      </div>
    </>
  );
}
