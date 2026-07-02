import { prisma } from "@/lib/db";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import { WorkflowEditor } from "@/components/workflow-editor";
import type { RequestType } from "@prisma/client";

const TYPES: RequestType[] = ["CREATION", "MODIFICATION", "DEPART"];

export default async function ParametresWorkflowsPage() {
  const [steps, users] = await Promise.all([
    prisma.workflowStep.findMany({ orderBy: { ordre: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, role: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Chaque type de demande suit son propre circuit d&apos;étapes ordonnées. À chaque
        étape, les valideurs concernés sont <strong>notifiés par mail</strong> ; le
        premier qui se prononce fait avancer (ou refuse) la demande. Sans étape, les
        demandes sont approuvées immédiatement.
      </p>
      {TYPES.map((type) => (
        <WorkflowEditor
          key={type}
          type={type}
          title={REQUEST_TYPE_LABELS[type]}
          users={users}
          initialSteps={steps
            .filter((s) => s.type === type)
            .map((s) => ({
              nom: s.nom,
              validatorRole: s.validatorRole ?? undefined,
              validatorUserIds: s.validatorUserIds ?? undefined,
            }))}
        />
      ))}
    </div>
  );
}
