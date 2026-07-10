"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/parametres", label: "Général" },
  { href: "/parametres/services", label: "Services & applications" },
  { href: "/parametres/equipements", label: "Équipements" },
  { href: "/parametres/workflows", label: "Circuits de validation" },
  { href: "/parametres/utilisateurs", label: "Utilisateurs & rôles" },
  { href: "/parametres/annuaire", label: "Annuaire AD (LDAPS)" },
  { href: "/parametres/messagerie", label: "Messagerie (SMTP)" },
  { href: "/parametres/connecteurs", label: "Connecteurs" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => {
        const active =
          t.href === "/parametres" ? pathname === "/parametres" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              active
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
