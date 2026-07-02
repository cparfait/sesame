import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { AGENT_STATUT_LABELS, fmtDate } from "@/lib/constants";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statut = params.statut === "PARTI" ? "PARTI" : params.statut === "ACTIF" ? "ACTIF" : undefined;

  const agents = await prisma.agent.findMany({
    where: {
      statut,
      ...(q && {
        OR: [
          { nom: { contains: q, mode: "insensitive" } },
          { prenom: { contains: q, mode: "insensitive" } },
          { service: { contains: q, mode: "insensitive" } },
          { direction: { contains: q, mode: "insensitive" } },
          { adLogin: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    take: 300,
    include: { _count: { select: { accesses: { where: { statut: "ACTIF" } } } } },
  });

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Référentiel des agents et de leurs accès — alimenté par les demandes approuvées"
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/agents">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Nom, service, identifiant AD…"
            className="w-72 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {statut && <input type="hidden" name="statut" value={statut} />}
        <div className="flex gap-2">
          {[
            { label: "Tous", value: "" },
            { label: "En poste", value: "ACTIF" },
            { label: "Partis", value: "PARTI" },
          ].map((f) => (
            <Link
              key={f.value}
              href={`/agents?${new URLSearchParams({ ...(q && { q }), ...(f.value && { statut: f.value }) })}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                (statut ?? "") === f.value
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      {agents.length === 0 ? (
        <EmptyState
          title="Aucun agent dans le référentiel"
          hint="Les agents sont créés automatiquement à l'approbation d'une demande de création."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Direction / service</th>
                <th className="px-4 py-3 font-medium">Fonction</th>
                <th className="px-4 py-3 font-medium">Compte AD</th>
                <th className="px-4 py-3 font-medium">Accès</th>
                <th className="px-4 py-3 font-medium">Arrivée</th>
                <th className="px-4 py-3 text-right font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map((a) => (
                <tr key={a.id} className="group hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <Link
                      href={`/agents/${a.id}`}
                      className="font-medium group-hover:text-indigo-600"
                    >
                      {a.nom.toUpperCase()} {a.prenom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {[a.direction, a.service].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{a.fonction ?? "—"}</td>
                  <td className="px-4 py-3">
                    {a.adLogin ? (
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                        {a.adLogin}
                      </code>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {a._count.accesses}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(a.dateArrivee)}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      color={
                        a.statut === "ACTIF"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-slate-100 text-slate-500 ring-slate-500/20"
                      }
                    >
                      {AGENT_STATUT_LABELS[a.statut]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
