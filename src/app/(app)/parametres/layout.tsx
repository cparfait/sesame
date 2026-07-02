import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/settings-tabs";

export default async function ParametresLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser("ADMIN");
  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration de Sésame — réservée aux administrateurs"
      />
      <SettingsTabs />
      {children}
    </>
  );
}
