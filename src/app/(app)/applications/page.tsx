import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Badge, EmptyState, PageHeader, btnPrimary } from "@/components/ui";

export default async function ApplicationsPage() {
  const user = await requireUser("VALIDATEUR", "TECHNICIEN", "LECTEUR");
  const apps = await prisma.application.findMany({
    orderBy: { nom: "asc" },
    include: {
      _count: { select: { accesses: { where: { statut: "ACTIF" } } } },
    },
  });
  const canEdit = ["ADMIN", "TECHNICIEN"].includes(user.role);

  return (
    <>
      <PageHeader
        title="Applications métiers"
        subtitle="Le référentiel des applications et outils dont les accès sont suivis"
      >
        {canEdit && (
          <Link href="/applications/nouvelle" className={btnPrimary}>
            <Plus className="h-4 w-4" /> Nouvelle application
          </Link>
        )}
      </PageHeader>

      {apps.length === 0 ? (
        <EmptyState
          title="Aucune application déclarée"
          hint="Commencez par déclarer vos applications métiers : RH, finances, urbanisme, messagerie…"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={canEdit ? `/applications/${app.id}` : "#"}
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition ${
                canEdit ? "hover:border-indigo-200 hover:shadow" : "cursor-default"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{app.nom}</p>
                <span className="flex gap-1.5">
                  {app.source === "sentinelle" && (
                    <Badge color="bg-cyan-50 text-cyan-700 ring-cyan-600/20">
                      Sentinelle
                    </Badge>
                  )}
                  {!app.actif && (
                    <Badge color="bg-slate-100 text-slate-500 ring-slate-500/20">
                      Inactive
                    </Badge>
                  )}
                </span>
              </div>
              {app.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {app.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(app.profils ?? "")
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600"
                    >
                      {p}
                    </span>
                  ))}
              </div>
              <p className="mt-3 text-sm text-slate-400">
                {app._count.accesses} accès actif{app._count.accesses > 1 ? "s" : ""}
                {app.referent ? ` · référent : ${app.referent}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
