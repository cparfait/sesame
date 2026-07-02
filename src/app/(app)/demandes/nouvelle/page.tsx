import Link from "next/link";
import { UserMinus, UserPen, UserPlus } from "lucide-react";
import type { RequestType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import {
  CreationForm,
  DepartForm,
  ModificationForm,
  type AgentDto,
  type AccessDto,
  type ApplicationDto,
} from "@/components/request-forms";

const TYPE_CARDS: { type: RequestType; label: string; desc: string; icon: typeof UserPlus }[] = [
  {
    type: "CREATION",
    label: "Création de compte",
    desc: "Arrivée d'un nouvel agent",
    icon: UserPlus,
  },
  {
    type: "MODIFICATION",
    label: "Modification",
    desc: "Mobilité, changement de fonction ou d'accès",
    icon: UserPen,
  },
  {
    type: "DEPART",
    label: "Départ",
    desc: "Sortie : suppression des comptes et accès",
    icon: UserMinus,
  },
];

export default async function NouvelleDemandePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; agentId?: string }>;
}) {
  await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const params = await searchParams;
  const type: RequestType = ["CREATION", "MODIFICATION", "DEPART"].includes(
    params.type ?? "",
  )
    ? (params.type as RequestType)
    : "CREATION";

  const [applicationsRaw, agentsRaw] = await Promise.all([
    prisma.application.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.agent.findMany({
      where: { statut: "ACTIF" },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ]);
  const applications: ApplicationDto[] = applicationsRaw.map((a) => ({
    id: a.id,
    nom: a.nom,
    profils: a.profils,
  }));
  const agents: AgentDto[] = agentsRaw.map((a) => ({
    id: a.id,
    nom: a.nom,
    prenom: a.prenom,
    service: a.service,
    email: a.email,
    telephone: a.telephone,
    statutEmploi: a.statutEmploi,
    direction: a.direction,
    fonction: a.fonction,
    site: a.site,
    responsable: a.responsable,
    teletravail: a.teletravail,
    dateFinContrat: a.dateFinContrat?.toISOString().slice(0, 10) ?? null,
  }));

  let agent: AgentDto | null = null;
  let accesses: AccessDto[] = [];
  if (params.agentId && type !== "CREATION") {
    agent = agents.find((a) => a.id === params.agentId) ?? null;
    if (agent) {
      const rows = await prisma.agentAccess.findMany({
        where: { agentId: agent.id, statut: "ACTIF" },
        include: { application: true },
      });
      accesses = rows.map((r) => ({
        id: r.id,
        label: `${r.application.nom}${r.profil ? ` (${r.profil})` : ""}`,
      }));
    }
  }

  return (
    <>
      <PageHeader
        title="Nouvelle demande"
        subtitle="La demande suivra le circuit de validation paramétré pour son type"
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {TYPE_CARDS.map((c) => {
          const active = c.type === type;
          const Icon = c.icon;
          return (
            <Link
              key={c.type}
              href={`/demandes/nouvelle?type=${c.type}${params.agentId ? `&agentId=${params.agentId}` : ""}`}
              className={`rounded-2xl border p-4 transition ${
                active
                  ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-indigo-600" : "text-slate-400"}`}
              />
              <p className="mt-2 text-sm font-semibold">{c.label}</p>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </Link>
          );
        })}
      </div>

      {type === "CREATION" && <CreationForm applications={applications} />}
      {type === "MODIFICATION" && (
        <ModificationForm
          agents={agents}
          applications={applications}
          agent={agent}
          accesses={accesses}
        />
      )}
      {type === "DEPART" && (
        <DepartForm agents={agents} agent={agent} accesses={accesses} />
      )}
    </>
  );
}
