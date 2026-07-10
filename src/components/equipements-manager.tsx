"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteEquipement,
  saveEquipement,
  searchAdAccounts,
  type ResponsableAd,
} from "@/lib/actions/equipements";
import { Alert, Badge, Field, Input, btnPrimary, btnSecondary } from "@/components/ui";

export type EquipementDto = {
  id: string;
  nom: string;
  responsable: ResponsableAd | null;
  actif: boolean;
};

/** Recherche d'un responsable dans l'annuaire AD (typeahead). */
function ResponsableAdPicker({
  value,
  onChange,
}: {
  value: ResponsableAd | null;
  onChange: (r: ResponsableAd | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResponsableAd[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      startTransition(async () => {
        setResults(await searchAdAccounts(q));
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // referme la liste au clic à l'extérieur
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        <span className="flex-1 font-medium text-slate-700">
          {value.displayName}
          <span className="ml-1.5 font-normal text-slate-400">({value.samAccountName})</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
          title="Retirer le responsable"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Rechercher dans l'annuaire AD…"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {pending && (
            <li className="px-3 py-2 text-sm text-slate-400">Recherche…</li>
          )}
          {!pending && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">Aucun compte trouvé.</li>
          )}
          {results.map((r) => (
            <li key={r.samAccountName}>
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                <span className="font-medium text-slate-700">{r.displayName}</span>
                <span className="text-xs text-slate-400">
                  {r.samAccountName}
                  {r.email ? ` · ${r.email}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EquipementEditor({
  equipement,
  onClose,
}: {
  equipement: EquipementDto | null; // null = nouveau
  onClose: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(equipement?.nom ?? "");
  const [responsable, setResponsable] = useState<ResponsableAd | null>(
    equipement?.responsable ?? null,
  );
  const [actif, setActif] = useState(equipement?.actif ?? true);
  const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await saveEquipement({
        id: equipement?.id,
        nom,
        responsable,
        actif,
      });
      setState(result);
      if (result?.success) {
        router.refresh();
        onClose();
      }
    });

  const remove = () => {
    if (!equipement) return;
    if (!window.confirm(`Supprimer l'équipement « ${equipement.nom} » ?`)) return;
    startTransition(async () => {
      await deleteEquipement(equipement.id);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <Alert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'équipement" required>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Badge d'accès" />
        </Field>
        <Field label="Responsable (préparation)">
          <ResponsableAdPicker value={responsable} onChange={setResponsable} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          className="h-4 w-4 accent-indigo-600"
        />
        Actif (proposé dans les demandes de création)
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {equipement && (
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="mr-1 inline h-4 w-4" /> Supprimer
          </button>
        )}
        <button onClick={onClose} disabled={pending} className={btnSecondary}>
          Fermer
        </button>
        <button onClick={save} disabled={pending} className={btnPrimary}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

export function EquipementsManager({
  equipements,
}: {
  equipements: EquipementDto[];
}) {
  const [openId, setOpenId] = useState<string | null>(null); // id ou "new"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Équipements
        </h2>
        <button
          onClick={() => setOpenId(openId === "new" ? null : "new")}
          className={btnSecondary}
        >
          <Plus className="h-4 w-4" /> Nouvel équipement
        </button>
      </div>

      {openId === "new" && (
        <EquipementEditor equipement={null} onClose={() => setOpenId(null)} />
      )}

      {equipements.length === 0 && openId !== "new" ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Aucun équipement : la section « Équipements à prévoir » des demandes de
          création sera vide.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {equipements.map((e) =>
            openId === e.id ? (
              <div key={e.id} className="p-3">
                <EquipementEditor equipement={e} onClose={() => setOpenId(null)} />
              </div>
            ) : (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm font-medium">{e.nom}</span>
                {e.responsable ? (
                  <Badge color="bg-blue-50 text-blue-700 ring-blue-600/20">
                    Resp. : {e.responsable.displayName}
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-400">Sans responsable</span>
                )}
                {!e.actif && (
                  <Badge color="bg-slate-100 text-slate-500 ring-slate-500/20">Inactif</Badge>
                )}
                <button
                  onClick={() => setOpenId(e.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
