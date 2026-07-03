"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteEquipement, saveEquipement } from "@/lib/actions/equipements";
import { Alert, Badge, Field, Input, Select, btnPrimary, btnSecondary } from "@/components/ui";

export type EquipementDto = {
  id: string;
  nom: string;
  responsableId: string | null;
  responsableNom: string | null;
  actif: boolean;
};

type UserOption = { id: string; displayName: string };

function EquipementEditor({
  equipement,
  users,
  onClose,
}: {
  equipement: EquipementDto | null; // null = nouveau
  users: UserOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(equipement?.nom ?? "");
  const [responsableId, setResponsableId] = useState(equipement?.responsableId ?? "");
  const [actif, setActif] = useState(equipement?.actif ?? true);
  const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await saveEquipement({
        id: equipement?.id,
        nom,
        responsableId: responsableId || null,
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
          <Select value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
            <option value="">— Aucun</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </Select>
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
  users,
}: {
  equipements: EquipementDto[];
  users: UserOption[];
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
        <EquipementEditor equipement={null} users={users} onClose={() => setOpenId(null)} />
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
                <EquipementEditor
                  equipement={e}
                  users={users}
                  onClose={() => setOpenId(null)}
                />
              </div>
            ) : (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm font-medium">{e.nom}</span>
                {e.responsableNom ? (
                  <Badge color="bg-blue-50 text-blue-700 ring-blue-600/20">
                    Resp. : {e.responsableNom}
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
