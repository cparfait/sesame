import { prisma } from "@/lib/db";
import { WorkflowsManager, type WorkflowDto } from "@/components/workflow-editor";

export default async function ParametresWorkflowsPage() {
  const [workflows, users, adAccounts] = await Promise.all([
    prisma.workflow.findMany({
      include: { steps: { orderBy: { ordre: "asc" } } },
      orderBy: [{ priorite: "desc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, role: true },
    }),
    prisma.adAccount.findMany({
      where: { groups: { not: null } },
      select: { groups: true },
    }),
  ]);

  // liste des groupes AD connus (via la synchro) pour l'autocomplétion
  const adGroups = [
    ...new Set(adAccounts.flatMap((a) => a.groups!.split("\n").filter(Boolean))),
  ]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .slice(0, 300);

  const dtos: WorkflowDto[] = workflows.map((w) => ({
    id: w.id,
    nom: w.nom,
    type: w.type,
    actif: w.actif,
    isDefault: w.isDefault,
    matchService: w.matchService,
    matchAdGroup: w.matchAdGroup,
    priorite: w.priorite,
    steps: w.steps.map((s) => ({
      nom: s.nom,
      validatorRole: s.validatorRole ?? undefined,
      validatorUserIds: s.validatorUserIds ?? undefined,
    })),
  }));

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Créez autant de circuits que nécessaire (un par service, par direction…).
        À la création d&apos;une demande, Sésame choisit le circuit dont les{" "}
        <strong>critères correspondent</strong> (service de la demande, groupe AD
        du demandeur), sinon le circuit <strong>par défaut</strong> du type. À
        chaque étape, les valideurs sont <strong>notifiés par mail</strong> ; le
        premier qui se prononce fait avancer ou refuse la demande.
      </p>
      <WorkflowsManager workflows={dtos} users={users} adGroups={adGroups} />
    </div>
  );
}
