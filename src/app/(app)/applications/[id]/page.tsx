import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ApplicationForm } from "@/components/application-form";

export default async function ApplicationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser("TECHNICIEN");
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      _count: { select: { accesses: { where: { statut: "ACTIF" } } } },
    },
  });
  if (!app) notFound();
  return (
    <>
      <PageHeader title={app.nom} subtitle="Modifier la fiche de l'application" />
      <ApplicationForm
        app={{
          id: app.id,
          nom: app.nom,
          description: app.description,
          referent: app.referent,
          profils: app.profils,
          fonction: app.fonction,
          actif: app.actif,
          accessCount: app._count.accesses,
        }}
      />
    </>
  );
}
