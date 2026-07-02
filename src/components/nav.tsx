"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppWindow,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  Network,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@prisma/client";

// DEMANDEUR : vue simplifiée — uniquement ses demandes
const items = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  {
    href: "/demandes",
    label: "Demandes",
    labelDemandeur: "Mes demandes",
    icon: ClipboardList,
  },
  {
    href: "/agents",
    label: "Agents",
    icon: Users,
    roles: ["ADMIN", "VALIDATEUR", "TECHNICIEN", "LECTEUR"],
  },
  {
    href: "/applications",
    label: "Applications",
    icon: AppWindow,
    roles: ["ADMIN", "VALIDATEUR", "TECHNICIEN", "LECTEUR"],
  },
  {
    href: "/annuaire",
    label: "Annuaire AD",
    icon: Network,
    roles: ["ADMIN", "VALIDATEUR", "TECHNICIEN", "LECTEUR"],
  },
  { href: "/journal", label: "Journal", icon: ScrollText, roles: ["ADMIN"] },
  { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <KeyRound className="h-4.5 w-4.5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Sésame</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {items
          .filter((i) => !i.roles || i.roles.includes(role))
          .map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {role === "DEMANDEUR" && item.labelDemandeur
                  ? item.labelDemandeur
                  : item.label}
              </Link>
            );
          })}
      </nav>
      <p className="border-t border-slate-100 p-4 text-xs text-slate-400">
        Comptes & habilitations
      </p>
    </aside>
  );
}
