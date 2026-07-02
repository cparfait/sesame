import Link from "next/link";
import { Plus } from "lucide-react";
import type { RequestStatut, RequestType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Badge, EmptyState, PageHeader, btnPrimary } from "@/components/ui";
import {
  REQUEST_STATUT_COLORS,
  REQUEST_STATUT_LABELS,
  REQUEST_TYPE_LABELS,
  fmtDate,
  requestObjet,
} from "@/lib/constants";

const STATUTS = Object.keys(REQUEST_STATUT_LABELS) as RequestStatut[];
const TYPES = Object.keys(REQUEST_TYPE_LABELS) as RequestType[];

export default async function DemandesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; type?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const statut = STATUTS.includes(params.statut as RequestStatut)
    ? (params.statut as RequestStatut)
    : undefined;
  const type = TYPES.includes(params.type as RequestType)
    ? (params.type as RequestType)
    : undefined;

  // un demandeur ne voit que ses propres demandes
  const isDemandeur = user.role === "DEMANDEUR";
  const demandes = await prisma.request.findMany({
    where: { statut, type, ...(isDemandeur && { requesterId: user.id }) },
    orderBy: { numero: "desc" },
    take: 200,
    include: { requester: true, tasks: true },
  });

  const filterLink = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title={isDemandeur ? "Mes demandes" : "Demandes"}
        subtitle="Créations, modifications et départs — suivis de bout en bout"
      >
        {user.role !== "LECTEUR" && (
          <Link href="/demandes/nouvelle" className={btnPrimary}>
            <Plus className="h-4 w-4" /> Nouvelle demande
          </Link>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {filterLink("Toutes", "/demandes", !statut && !type)}
        {STATUTS.map((s) =>
          filterLink(
            REQUEST_STATUT_LABELS[s],
            `/demandes?statut=${s}${type ? `&type=${type}` : ""}`,
            statut === s,
          ),
        )}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TYPES.map((t) =>
          filterLink(
            REQUEST_TYPE_LABELS[t],
            `/demandes?type=${t}${statut ? `&statut=${statut}` : ""}`,
            type === t,
          ),
        )}
      </div>

      {demandes.length === 0 ? (
        <EmptyState
          title="Aucune demande ne correspond à ces critères"
          hint="Modifiez les filtres ou créez une nouvelle demande."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Objet</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Demandeur</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Avancement</th>
                <th className="px-4 py-3 text-right font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demandes.map((r) => {
                const done = r.tasks.filter((t) => t.statut !== "A_FAIRE").length;
                return (
                  <tr key={r.id} className="group hover:bg-slate-50/70">
                    <td className="px-4 py-3 tabular-nums text-slate-400">{r.numero}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/demandes/${r.id}`}
                        className="font-medium text-slate-900 group-hover:text-indigo-600"
                      >
                        {requestObjet(r.type, r.payload)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {REQUEST_TYPE_LABELS[r.type]}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.requester.displayName}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.tasks.length > 0 ? `${done}/${r.tasks.length} tâches` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge color={REQUEST_STATUT_COLORS[r.statut]}>
                        {REQUEST_STATUT_LABELS[r.statut]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
