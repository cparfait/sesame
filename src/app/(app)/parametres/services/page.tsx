import { prisma } from "@/lib/db";
import { ServicesManager, type ServiceDto } from "@/components/services-manager";

export default async function ParametresServicesPage() {
  const [services, applications, workflows] = await Promise.all([
    prisma.service.findMany({
      include: { applications: { select: { applicationId: true } } },
      orderBy: { nom: "asc" },
    }),
    prisma.application.findMany({
      where: { actif: true },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    }),
    prisma.workflow.findMany({
      where: { actif: true },
      orderBy: [{ priorite: "desc" }, { createdAt: "asc" }],
      select: { id: true, nom: true, type: true },
    }),
  ]);

  const dtos: ServiceDto[] = services.map((s) => ({
    id: s.id,
    nom: s.nom,
    description: s.description,
    actif: s.actif,
    applicationIds: s.applications.map((a) => a.applicationId),
    adGroups: s.adGroups,
    workflowCreationId: s.workflowCreationId,
    workflowModificationId: s.workflowModificationId,
    workflowDepartId: s.workflowDepartId,
  }));

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Un <strong>service</strong> regroupe les applications métiers proposées à
        la demande et, au plus, un <strong>circuit de validation</strong> par type
        de demande. À la connexion, le demandeur choisit d&apos;abord un service,
        puis ne voit que les logiciels qui y sont rattachés. Le circuit rattaché
        au service est <strong>prioritaire</strong> ; à défaut, Sésame utilise les
        critères des circuits (service / groupe AD) puis le circuit par défaut.
      </p>
      <ServicesManager services={dtos} applications={applications} workflows={workflows} />
    </div>
  );
}
