import { prisma } from "@/lib/db";
import { EquipementsManager, type EquipementDto } from "@/components/equipements-manager";

export default async function ParametresEquipementsPage() {
  const equipements = await prisma.equipement.findMany({
    orderBy: { nom: "asc" },
    include: { responsable: { select: { login: true, displayName: true, email: true } } },
  });

  const dtos: EquipementDto[] = equipements.map((e) => ({
    id: e.id,
    nom: e.nom,
    responsable: e.responsable
      ? {
          samAccountName: e.responsable.login,
          displayName: e.responsable.displayName,
          email: e.responsable.email,
        }
      : null,
    actif: e.actif,
  }));

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Gérez le matériel proposé à la création d&apos;un agent. Chaque équipement
        peut avoir un <strong>responsable</strong> recherché dans l&apos;annuaire AD,
        chargé de sa préparation ; il apparaîtra dans la tâche de provisionnement
        générée et sera prévenu par lien magique.
      </p>
      <EquipementsManager equipements={dtos} />
    </div>
  );
}
