import { getLdapSettings } from "@/lib/settings";
import { LdapForm } from "@/components/settings-forms";

export default async function ParametresAnnuairePage() {
  const settings = await getLdapSettings();
  return <LdapForm settings={settings} />;
}
