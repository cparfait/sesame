import Link from "next/link";
import type { ReactNode } from "react";
import { UserMinus, UserPen, UserPlus } from "lucide-react";
import type { RequestType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { CreationPayload } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import {
  CreationForm,
  DepartForm,
  ModificationForm,
  type AgentDto,
  type AccessDto,
  type ApplicationDto,
  type EquipementDto,
  type ServiceDto,
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
  const user = await requireUser("DEMANDEUR", "VALIDATEUR", "TECHNICIEN");
  const params = await searchParams;
  const type: RequestType | null = ["CREATION", "MODIFICATION", "DEPART"].includes(
    params.type ?? "",
  )
    ? (params.type as RequestType)
    : null;

  // Les données et le formulaire ne sont chargés qu'une fois un type choisi :
  // à l'arrivée, on ne présente que les trois choix.
  let form: ReactNode = null;
  if (type) {
    const [applicationsRaw, servicesRaw, equipementsRaw] = await Promise.all([
      prisma.application.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
      prisma.service.findMany({
        where: { actif: true },
        orderBy: { nom: "asc" },
        include: { applications: { select: { applicationId: true } } },
      }),
      prisma.equipement.findMany({
        where: { actif: true },
        orderBy: { nom: "asc" },
        select: { nom: true },
      }),
    ]);
    const equipements: EquipementDto[] = equipementsRaw.map((e) => ({ nom: e.nom }));
    const applications: ApplicationDto[] = applicationsRaw.map((a) => ({
      id: a.id,
      nom: a.nom,
      profils: a.profils,
    }));
    const services: ServiceDto[] = servicesRaw.map((s) => ({
      id: s.id,
      nom: s.nom,
      applicationIds: s.applications.map((a) => a.applicationId),
    }));

    // Pré-sélection du service selon l'appartenance AD du demandeur : dans la
    // grande majorité des cas il dépose une demande pour son propre service. On
    // rapproche les groupes AD du demandeur (miroir AdAccount) des groupes
    // rattachés aux services. Reste modifiable dans le formulaire.
    const cn = (s: string) => s.split(",")[0]?.replace(/^CN=/i, "").trim().toLowerCase() ?? "";
    const myAccount = await prisma.adAccount.findFirst({
      where: { samAccountName: { equals: user.login, mode: "insensitive" } },
      select: { groups: true },
    });
    const myGroups = new Set(
      (myAccount?.groups ?? "").split("\n").map(cn).filter(Boolean),
    );
    const suggestedService = myGroups.size
      ? servicesRaw.find((s) =>
          (s.adGroups ?? "").split("\n").map(cn).filter(Boolean).some((g) => myGroups.has(g)),
        )?.nom
      : undefined;

    // L'agent concerné est désigné via une recherche AD (rapproché / créé côté
    // action) : on ne charge ici que la fiche sélectionnée pour la préremplir.
    let agent: AgentDto | null = null;
    let accesses: AccessDto[] = [];
    if (params.agentId && type !== "CREATION") {
      const a = await prisma.agent.findUnique({ where: { id: params.agentId } });
      if (a) {
        // Demande initiale de l'agent : sa création (rapprochée par email), ou à
        // défaut la plus ancienne demande le concernant. On en reprend les
        // informations pour préremplir le formulaire.
        const prior = await prisma.request.findMany({
          where: {
            OR: [
              { agentId: a.id },
              ...(a.email
                ? [{ type: "CREATION" as const, payload: { path: ["email"], equals: a.email } }]
                : []),
            ],
          },
          orderBy: { createdAt: "asc" },
          take: 20,
        });
        const initial = prior.find((r) => r.type === "CREATION") ?? prior[0] ?? null;
        const fromReq = (key: keyof CreationPayload): string | undefined => {
          if (!initial) return undefined;
          const p = initial.payload as Record<string, unknown>;
          const raw =
            initial.type === "MODIFICATION"
              ? (p.champs as Record<string, unknown> | undefined)?.[key]
              : p[key];
          return typeof raw === "string" && raw ? raw : undefined;
        };

        // Repli service (aucune demande) : groupe AD de l'agent → service
        // rattaché à ce groupe (ex. GRP_DSI → DSI).
        const agentAccount = a.adLogin
          ? await prisma.adAccount.findFirst({
              where: { samAccountName: { equals: a.adLogin, mode: "insensitive" } },
              select: { groups: true },
            })
          : null;
        const agentGroups = new Set(
          (agentAccount?.groups ?? "").split("\n").map(cn).filter(Boolean),
        );
        const groupService = agentGroups.size
          ? servicesRaw.find((s) =>
              (s.adGroups ?? "")
                .split("\n")
                .map(cn)
                .filter(Boolean)
                .some((g) => agentGroups.has(g)),
            )?.nom
          : undefined;

        agent = {
          id: a.id,
          nom: a.nom,
          prenom: a.prenom,
          service: fromReq("service") ?? a.service ?? groupService ?? null,
          email: fromReq("email") ?? a.email,
          telephone: fromReq("telephone") ?? a.telephone,
          statutEmploi: fromReq("statutEmploi") ?? a.statutEmploi,
          direction: fromReq("direction") ?? a.direction,
          fonction: fromReq("fonction") ?? a.fonction,
          site: fromReq("site") ?? a.site,
          responsable: fromReq("responsable") ?? a.responsable,
          teletravail: fromReq("teletravail") ?? a.teletravail,
          dateFinContrat:
            fromReq("dateFinContrat") ?? a.dateFinContrat?.toISOString().slice(0, 10) ?? null,
        };
        const rows = await prisma.agentAccess.findMany({
          where: { agentId: a.id, statut: "ACTIF" },
          include: { application: true },
        });
        accesses = rows.map((r) => ({
          id: r.id,
          label: `${r.application.nom}${r.profil ? ` (${r.profil})` : ""}`,
        }));
      }
    }

    if (type === "CREATION") {
      form = (
        <CreationForm
          applications={applications}
          services={services}
          equipements={equipements}
          defaultService={suggestedService}
        />
      );
    } else if (type === "MODIFICATION") {
      form = (
        <ModificationForm
          applications={applications}
          services={services}
          agent={agent}
          accesses={accesses}
        />
      );
    } else {
      form = <DepartForm agent={agent} accesses={accesses} />;
    }
  }

  return (
    <>
      <PageHeader
        title="Nouvelle demande"
        subtitle={
          type
            ? "La demande suivra le circuit de validation paramétré pour son type"
            : "Choisissez le type de demande à déposer"
        }
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
              <Icon className={`h-5 w-5 ${active ? "text-indigo-600" : "text-slate-400"}`} />
              <p className="mt-2 text-sm font-semibold">{c.label}</p>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </Link>
          );
        })}
      </div>

      {form}
    </>
  );
}
