import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/constants";

export default async function JournalPage() {
  await requireUser("ADMIN");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: true },
  });

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        subtitle="Les 300 derniers événements : connexions, décisions, modifications, synchronisations"
      />
      {logs.length === 0 ? (
        <EmptyState title="Aucun événement enregistré" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Cible</th>
                <th className="px-4 py-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {fmtDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">{log.user?.displayName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{log.cible ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{log.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
