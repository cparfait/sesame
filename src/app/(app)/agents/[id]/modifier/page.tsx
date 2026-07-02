import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import {
  AccessManager,
  AgentEditForm,
  type AgentEditDto,
} from "@/components/agent-edit-form";

export default async function AgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser("TECHNICIEN");
  const [agent, applications] = await Promise.all([
    prisma.agent.findUnique({
      where: { id },
      include: {
        accesses: {
          where: { statut: { not: "SUPPRIME" } },
          include: { application: true },
          orderBy: { dateAttribution: "desc" },
        },
      },
    }),
    prisma.application.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!agent) notFound();

  const dto: AgentEditDto = {
    id: agent.id,
    civilite: agent.civilite,
    nom: agent.nom,
    prenom: agent.prenom,
    matricule: agent.matricule,
    email: agent.email,
    telephone: agent.telephone,
    statutEmploi: agent.statutEmploi,
    direction: agent.direction,
    service: agent.service,
    fonction: agent.fonction,
    site: agent.site,
    responsable: agent.responsable,
    adLogin: agent.adLogin,
    dateArrivee: agent.dateArrivee?.toISOString().slice(0, 10) ?? null,
    dateFinContrat: agent.dateFinContrat?.toISOString().slice(0, 10) ?? null,
    commentaire: agent.commentaire,
  };

  return (
    <>
      <PageHeader
        title={`Éditer — ${agent.nom.toUpperCase()} ${agent.prenom}`}
        subtitle="Mise à jour directe par la DSI, sans circuit de validation (tracée au journal)"
      />
      <div className="space-y-6">
        <AgentEditForm agent={dto} />
        <AccessManager
          agentId={agent.id}
          applications={applications.map((a) => ({ id: a.id, nom: a.nom }))}
          accesses={agent.accesses.map((a) => ({
            id: a.id,
            label: `${a.application.nom}${a.profil ? ` (${a.profil})` : ""}`,
            statut: a.statut,
          }))}
        />
      </div>
    </>
  );
}
