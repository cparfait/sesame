import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, UserMinus, UserPen } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Badge, Card, PageHeader, btnDanger, btnSecondary } from "@/components/ui";
import {
  ACCESS_STATUT_COLORS,
  ACCESS_STATUT_LABELS,
  AGENT_STATUT_LABELS,
  REQUEST_STATUT_COLORS,
  REQUEST_STATUT_LABELS,
  REQUEST_TYPE_LABELS,
  fmtDate,
} from "@/lib/constants";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser("VALIDATEUR", "TECHNICIEN", "LECTEUR");
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      accesses: {
        include: { application: true },
        orderBy: { dateAttribution: "desc" },
      },
      requests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!agent) notFound();

  const canEdit = ["ADMIN", "TECHNICIEN"].includes(user.role);
  const canRequest = user.role !== "LECTEUR";

  const infos: [string, string][] = [
    ["Civilité", agent.civilite ?? "—"],
    ["Matricule RH", agent.matricule ?? "—"],
    ["Email", agent.email ?? "—"],
    ["Téléphone", agent.telephone ?? "—"],
    ["Statut d'emploi", agent.statutEmploi],
    ["Direction", agent.direction ?? "—"],
    ["Service", agent.service ?? "—"],
    ["Fonction", agent.fonction ?? "—"],
    ["Site", agent.site ?? "—"],
    ["Responsable", agent.responsable ?? "—"],
    ["Télétravail", agent.teletravail ?? "—"],
    ["Date d'arrivée", fmtDate(agent.dateArrivee)],
    ["Fin de contrat", fmtDate(agent.dateFinContrat)],
    ["Date de départ", fmtDate(agent.dateDepart)],
    ["Compte AD", agent.adLogin ?? "non rapproché"],
  ];

  return (
    <>
      <PageHeader
        title={`${agent.nom.toUpperCase()} ${agent.prenom}`}
        subtitle={[agent.fonction, agent.service, agent.direction]
          .filter(Boolean)
          .join(" · ")}
      >
        <Badge
          color={
            agent.statut === "ACTIF"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-slate-100 text-slate-500 ring-slate-500/20"
          }
        >
          {AGENT_STATUT_LABELS[agent.statut]}
        </Badge>
        {canEdit && (
          <Link href={`/agents/${agent.id}/modifier`} className={btnSecondary}>
            <Pencil className="h-4 w-4" /> Éditer (DSI)
          </Link>
        )}
        {canRequest && agent.statut === "ACTIF" && (
          <>
            <Link
              href={`/demandes/nouvelle?type=MODIFICATION&agentId=${agent.id}`}
              className={btnSecondary}
            >
              <UserPen className="h-4 w-4" /> Demander une modification
            </Link>
            <Link
              href={`/demandes/nouvelle?type=DEPART&agentId=${agent.id}`}
              className={btnDanger}
            >
              <UserMinus className="h-4 w-4" /> Déclarer un départ
            </Link>
          </>
        )}
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card title="Fiche" className="lg:col-span-1">
          <dl className="space-y-1">
            {infos.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-slate-50 py-1.5 text-sm"
              >
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {agent.commentaire && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
              {agent.commentaire}
            </p>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title={`Accès aux applications (${agent.accesses.length})`}>
            {agent.accesses.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aucun accès enregistré pour cet agent.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-medium">Application</th>
                    <th className="py-2 pr-3 font-medium">Profil</th>
                    <th className="py-2 pr-3 font-medium">Attribué le</th>
                    <th className="py-2 pr-3 font-medium">Supprimé le</th>
                    <th className="py-2 text-right font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {agent.accesses.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 pr-3 font-medium">{a.application.nom}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{a.profil ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {fmtDate(a.dateAttribution)}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {fmtDate(a.dateSuppression)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge color={ACCESS_STATUT_COLORS[a.statut]}>
                          {ACCESS_STATUT_LABELS[a.statut]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Historique des demandes">
            {agent.requests.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune demande liée.</p>
            ) : (
              <ul className="divide-y divide-slate-50 text-sm">
                {agent.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5">
                    <Link
                      href={`/demandes/${r.id}`}
                      className="font-medium hover:text-indigo-600"
                    >
                      n° {r.numero} — {REQUEST_TYPE_LABELS[r.type]}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-400">{fmtDate(r.createdAt)}</span>
                      <Badge color={REQUEST_STATUT_COLORS[r.statut]}>
                        {REQUEST_STATUT_LABELS[r.statut]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
