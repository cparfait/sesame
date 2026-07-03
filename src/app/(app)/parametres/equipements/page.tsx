import { prisma } from "@/lib/db";
import { EquipementsManager, type EquipementDto } from "@/components/equipements-manager";

export default async function ParametresEquipementsPage() {
  const [equipements, users] = await Promise.all([
    prisma.equipement.findMany({
      orderBy: { nom: "asc" },
      include: { responsable: { select: { displayName: true } } },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  const dtos: EquipementDto[] = equipements.map((e) => ({
    id: e.id,
    nom: e.nom,
    responsableId: e.responsableId,
    responsableNom: e.responsable?.displayName ?? null,
    actif: e.actif,
  }));

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Gérez le matériel proposé à la création d&apos;un agent. Chaque équipement
        peut avoir un <strong>responsable</strong> (utilisateur Sésame) chargé de
        sa préparation ; il apparaîtra dans la tâche de provisionnement générée.
      </p>
      <EquipementsManager equipements={dtos} users={users} />
    </div>
  );
}
