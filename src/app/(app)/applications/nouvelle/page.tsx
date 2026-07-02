import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ApplicationForm } from "@/components/application-form";

export default async function NouvelleApplicationPage() {
  await requireUser("TECHNICIEN");
  return (
    <>
      <PageHeader
        title="Nouvelle application"
        subtitle="Déclarez une application métier dont les accès doivent être suivis"
      />
      <ApplicationForm app={null} />
    </>
  );
}
