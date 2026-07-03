import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { pendingRequestsFor } from "@/lib/workflow";
import { Card, PageHeader } from "@/components/ui";
import { TaskList, type TaskDto } from "@/components/task-list";
import { REQUEST_TYPE_LABELS, fmtDateTime, requestObjet } from "@/lib/constants";

export default async function TachesPage() {
  const user = await requireUser();
  const isTech = user.role === "ADMIN" || user.role === "TECHNICIEN";

  // validations en attente que cet utilisateur peut trancher
  const pendingReqs = await pendingRequestsFor(user);

  // tâches de provisionnement à faire : celles dont il est responsable, plus la
  // checklist partagée (sans responsable) pour les techniciens / admins
  const todo = await prisma.provisionTask.findMany({
    where: {
      statut: "A_FAIRE",
      request: { statut: "APPROUVEE" },
      OR: [
        { responsableId: user.id },
        ...(isTech ? [{ responsableId: null }] : []),
      ],
    },
    include: { request: { select: { numero: true } } },
    orderBy: [{ requestId: "asc" }, { id: "asc" }],
  });

  // historique : ses tâches traitées et ses décisions récentes
  const [doneTasks, myValidations] = await Promise.all([
    prisma.provisionTask.findMany({
      where: { doneById: user.id, statut: { in: ["FAIT", "NON_APPLICABLE"] } },
      include: { request: { select: { numero: true } } },
      orderBy: { doneAt: "desc" },
      take: 15,
    }),
    prisma.requestValidation.findMany({
      where: { userId: user.id },
      include: { request: { select: { id: true, numero: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const todoDtos: TaskDto[] = todo.map((t) => ({
    id: t.id,
    label: `n° ${t.request.numero} · ${t.label}`,
    categorie: t.categorie,
    statut: t.statut,
    doneByName: null,
    doneAt: null,
  }));

  const decisionLabel = (d: string) =>
    d === "APPROUVE" ? "validé" : d === "REFUSE" ? "refusé" : "renvoyé";

  return (
    <>
      <PageHeader
        title="Mes tâches"
        subtitle="Vos validations et tâches de provisionnement à traiter"
      />
      <div className="space-y-6">
        <Card title={`À valider — ${pendingReqs.length}`}>
          {pendingReqs.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune validation en attente.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingReqs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={`/demandes/${r.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-indigo-600"
                  >
                    n° {r.numero} · {requestObjet(r.type, r.payload)}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {REQUEST_TYPE_LABELS[r.type]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`À faire — ${todo.length} tâche${todo.length > 1 ? "s" : ""}`}>
          {todo.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucune tâche de provisionnement à réaliser.
            </p>
          ) : (
            <TaskList tasks={todoDtos} canEdit />
          )}
        </Card>

        <Card title="Historique récent">
          {doneTasks.length === 0 && myValidations.length === 0 ? (
            <p className="text-sm text-slate-400">Rien pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {myValidations.map((v) => (
                <li
                  key={v.id}
                  className="flex justify-between gap-3 border-b border-slate-50 py-1.5"
                >
                  <span className="text-slate-600">
                    <Link
                      href={`/demandes/${v.request.id}`}
                      className="font-medium text-slate-800 hover:text-indigo-600"
                    >
                      n° {v.request.numero}
                    </Link>{" "}
                    — {decisionLabel(v.decision)} ({v.stepNom})
                  </span>
                  <span className="text-xs text-slate-400">{fmtDateTime(v.createdAt)}</span>
                </li>
              ))}
              {doneTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex justify-between gap-3 border-b border-slate-50 py-1.5"
                >
                  <span className="text-slate-600">
                    n° {t.request.numero} — {t.label}{" "}
                    <span className="text-slate-400">
                      ({t.statut === "FAIT" ? "fait" : "N/A"})
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {t.doneAt ? fmtDateTime(t.doneAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
