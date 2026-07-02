import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth";
import { Sidebar } from "@/components/nav";
import { ROLE_LABELS } from "@/lib/constants";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-4 border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{user.displayName}</p>
            <p className="text-xs leading-tight text-slate-400">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Se déconnecter"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
