import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { DelegationForm } from "@/components/delegation-form";
import { fmtDate } from "@/lib/constants";

export default async function AbsencesPage() {
  const me = await requireUser();
  const [users, meFull] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, NOT: { id: me.id } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    prisma.user.findUnique({ where: { id: me.id } }),
  ]);

  const current = {
    absent: meFull?.absent ?? false,
    delegateToId: meFull?.delegateToId ?? null,
    delegateFrom: meFull?.delegateFrom?.toISOString().slice(0, 10) ?? null,
    delegateTo: meFull?.delegateTo?.toISOString().slice(0, 10) ?? null,
  };

  // vue admin : qui est actuellement absent et vers qui
  const absents =
    me.role === "ADMIN"
      ? await prisma.user.findMany({
          where: { absent: true },
          include: { delegateTo_: true },
          orderBy: { displayName: "asc" },
        })
      : [];

  return (
    <>
      <PageHeader
        title="Mes absences"
        subtitle="Déléguez vos validations à un collègue pendant vos absences"
      />
      <div className="space-y-6">
        <DelegationForm users={users} current={current} />

        {me.role === "ADMIN" && (
          <Card title="Absences en cours (tous les utilisateurs)">
            {absents.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune absence déclarée.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {absents.map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-medium">{u.displayName}</span>
                    <span className="text-slate-500">
                      → {u.delegateTo_?.displayName ?? "(aucun délégué)"}
                      {(u.delegateFrom || u.delegateTo) && (
                        <>
                          {" "}· {fmtDate(u.delegateFrom)} – {fmtDate(u.delegateTo)}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
