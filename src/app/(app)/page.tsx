import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { pendingRequestsFor } from "@/lib/workflow";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  btnPrimary,
} from "@/components/ui";
import {
  REQUEST_STATUT_COLORS,
  REQUEST_STATUT_LABELS,
  REQUEST_TYPE_LABELS,
  fmtDate,
  requestObjet,
} from "@/lib/constants";

export default async function DashboardPage() {
  const user = await requireUser();

  // Vue simplifiée pour les demandeurs : ils arrivent directement sur le choix
  // du type de demande (création / modification / départ) ; leur historique est
  // accessible depuis le menu « Mes demandes ».
  if (user.role === "DEMANDEUR") {
    redirect("/demandes/nouvelle");
  }

  const in30d = new Date();
  in30d.setDate(in30d.getDate() + 30);

  const [aValider, enValidation, enProvision, agentsPartis, finsContrat, recentes] =
    await Promise.all([
      pendingRequestsFor(user),
      prisma.request.count({ where: { statut: "EN_VALIDATION" } }),
      prisma.request.count({ where: { statut: "APPROUVEE" } }),
      prisma.agent.findMany({
        where: { statut: "PARTI", adLogin: { not: null } },
        select: { id: true, nom: true, prenom: true, adLogin: true },
      }),
      prisma.agent.findMany({
        where: {
          statut: "ACTIF",
          dateFinContrat: { not: null, lte: in30d },
        },
        orderBy: { dateFinContrat: "asc" },
        take: 6,
      }),
      prisma.request.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { requester: true },
      }),
    ]);

  // comptes AD encore actifs pour des agents partis
  const adAlertes =
    agentsPartis.length > 0
      ? await prisma.adAccount.findMany({
          where: {
            enabled: true,
            samAccountName: { in: agentsPartis.map((a) => a.adLogin!) },
          },
        })
      : [];

  const stats = [
    {
      label: "À valider par moi",
      value: aValider.length,
      href: "/demandes?statut=EN_VALIDATION",
      icon: CheckSquare,
      accent: aValider.length > 0 ? "text-amber-600 bg-amber-50" : "text-slate-400 bg-slate-50",
    },
    {
      label: "Demandes en validation",
      value: enValidation,
      href: "/demandes?statut=EN_VALIDATION",
      icon: ClipboardList,
      accent: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Provisionnements en cours",
      value: enProvision,
      href: "/demandes?statut=APPROUVEE",
      icon: CalendarClock,
      accent: "text-blue-600 bg-blue-50",
    },
    {
      label: "Alertes AD (départs)",
      value: adAlertes.length,
      href: "/annuaire",
      icon: AlertTriangle,
      accent: adAlertes.length > 0 ? "text-red-600 bg-red-50" : "text-slate-400 bg-slate-50",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.displayName.split(" ")[0]}`}
        subtitle="Vue d'ensemble des comptes et des demandes en cours"
      >
        {user.role !== "LECTEUR" && (
          <Link href="/demandes/nouvelle" className={btnPrimary}>
            <Plus className="h-4 w-4" /> Nouvelle demande
          </Link>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow"
          >
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.accent}`}>
              <s.icon className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </Link>
        ))}
      </div>

      {adAlertes.length > 0 && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {adAlertes.length} compte{adAlertes.length > 1 ? "s" : ""} AD encore actif
            {adAlertes.length > 1 ? "s" : ""} pour des agents partis
          </p>
          <p className="mt-1 text-sm text-red-600">
            {adAlertes.map((a) => a.samAccountName).join(", ")} —{" "}
            <Link href="/annuaire" className="font-medium underline">
              voir l&apos;annuaire
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Dernières demandes" className="lg:col-span-2">
          {recentes.length === 0 ? (
            <EmptyState
              title="Aucune demande pour le moment"
              hint="Créez votre première demande de création, modification ou départ."
            />
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {recentes.map((r) => (
                  <tr key={r.id} className="group">
                    <td className="py-2.5 pr-3 font-medium tabular-nums text-slate-400">
                      n° {r.numero}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/demandes/${r.id}`}
                        className="font-medium text-slate-900 group-hover:text-indigo-600"
                      >
                        {requestObjet(r.type, r.payload)}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {REQUEST_TYPE_LABELS[r.type]} · {fmtDate(r.createdAt)}
                      </p>
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge color={REQUEST_STATUT_COLORS[r.statut]}>
                        {REQUEST_STATUT_LABELS[r.statut]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Fins de contrat sous 30 jours">
          {finsContrat.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune échéance proche.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {finsContrat.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <Link
                    href={`/agents/${a.id}`}
                    className="font-medium hover:text-indigo-600"
                  >
                    {a.prenom} {a.nom}
                  </Link>
                  <span className="text-slate-500">{fmtDate(a.dateFinContrat)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
