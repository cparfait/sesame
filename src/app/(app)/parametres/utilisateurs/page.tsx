import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/constants";
import { CreateLocalUserForm, UsersTable } from "@/components/users-table";

export default async function ParametresUtilisateursPage() {
  const me = await requireUser("ADMIN");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Les utilisateurs AD apparaissent ici après leur première connexion. Rôles :{" "}
        {Object.values(ROLE_LABELS).join(" · ")}.
      </p>
      <UsersTable
        meId={me.id}
        users={users.map((u) => ({
          id: u.id,
          login: u.login,
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          isLocal: u.isLocal,
          active: u.active,
        }))}
      />
      <CreateLocalUserForm />
    </div>
  );
}
