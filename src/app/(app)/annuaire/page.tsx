import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { SyncButton } from "@/components/sync-button";
import { fmtDate, fmtDateTime } from "@/lib/constants";

export default async function AnnuairePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const filtre = params.filtre ?? "";

  const [accounts, agents, lastSync] = await Promise.all([
    prisma.adAccount.findMany({
      where: q
        ? {
            OR: [
              { samAccountName: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { ou: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { samAccountName: "asc" },
      take: 500,
    }),
    prisma.agent.findMany({
      where: { adLogin: { not: null } },
      select: { id: true, nom: true, prenom: true, adLogin: true, statut: true },
    }),
    prisma.adAccount.findFirst({ orderBy: { syncedAt: "desc" } }),
  ]);

  const agentByLogin = new Map(
    agents.map((a) => [a.adLogin!.toLowerCase(), a]),
  );

  // alertes : agents partis dont le compte AD est toujours actif
  const alertes = accounts.filter((acc) => {
    const agent = agentByLogin.get(acc.samAccountName.toLowerCase());
    return acc.enabled && agent?.statut === "PARTI";
  });

  const filtered = accounts.filter((acc) => {
    const agent = agentByLogin.get(acc.samAccountName.toLowerCase());
    switch (filtre) {
      case "actifs":
        return acc.enabled;
      case "desactives":
        return !acc.enabled;
      case "orphelins":
        return !agent;
      case "alertes":
        return acc.enabled && agent?.statut === "PARTI";
      default:
        return true;
    }
  });

  const canSync = ["ADMIN", "TECHNICIEN"].includes(user.role);

  const filters = [
    { label: `Tous (${accounts.length})`, value: "" },
    { label: "Actifs", value: "actifs" },
    { label: "Désactivés", value: "desactives" },
    { label: "Sans agent lié", value: "orphelins" },
    { label: `⚠ Alertes départ (${alertes.length})`, value: "alertes" },
  ];

  return (
    <>
      <PageHeader
        title="Annuaire AD"
        subtitle={
          lastSync
            ? `Lecture seule via LDAPS — dernière synchronisation : ${fmtDateTime(lastSync.syncedAt)}`
            : "Lecture seule via LDAPS — aucune synchronisation effectuée pour l'instant"
        }
      >
        {canSync && <SyncButton />}
      </PageHeader>

      {alertes.length > 0 && filtre !== "alertes" && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">
            <strong>{alertes.length}</strong> compte{alertes.length > 1 ? "s" : ""} AD
            encore actif{alertes.length > 1 ? "s" : ""} pour des agents partis.{" "}
            <Link href="/annuaire?filtre=alertes" className="font-semibold underline">
              Voir la liste
            </Link>
          </p>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/annuaire">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Identifiant, nom, email, OU…"
            className="w-72 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={`/annuaire?${new URLSearchParams({ ...(q && { q }), ...(f.value && { filtre: f.value }) })}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filtre === f.value
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      {accounts.length === 0 ? (
        <EmptyState
          title="Aucun compte AD synchronisé"
          hint="Configurez la connexion LDAPS dans Paramètres → Annuaire AD, puis lancez une synchronisation."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Compte</th>
                <th className="px-4 py-3 font-medium">Nom affiché</th>
                <th className="px-4 py-3 font-medium">OU</th>
                <th className="px-4 py-3 font-medium">Dernière connexion</th>
                <th className="px-4 py-3 font-medium">Agent lié</th>
                <th className="px-4 py-3 text-right font-medium">État AD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((acc) => {
                const agent = agentByLogin.get(acc.samAccountName.toLowerCase());
                const isAlerte = acc.enabled && agent?.statut === "PARTI";
                return (
                  <tr
                    key={acc.id}
                    className={isAlerte ? "bg-red-50/60" : "hover:bg-slate-50/70"}
                  >
                    <td className="px-4 py-3">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                        {acc.samAccountName}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium">{acc.displayName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{acc.ou || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(acc.lastLogon)}</td>
                    <td className="px-4 py-3">
                      {agent ? (
                        <Link
                          href={`/agents/${agent.id}`}
                          className={`font-medium hover:underline ${
                            agent.statut === "PARTI" ? "text-red-600" : "text-indigo-600"
                          }`}
                        >
                          {agent.prenom} {agent.nom}
                          {agent.statut === "PARTI" && " (parti)"}
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge
                        color={
                          acc.enabled
                            ? isAlerte
                              ? "bg-red-50 text-red-700 ring-red-600/20"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                            : "bg-slate-100 text-slate-500 ring-slate-500/20"
                        }
                      >
                        {acc.enabled ? (isAlerte ? "Actif ⚠" : "Actif") : "Désactivé"}
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
