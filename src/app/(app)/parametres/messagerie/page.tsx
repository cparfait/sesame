import { getSmtpSettings } from "@/lib/settings";
import { SmtpForm } from "@/components/settings-forms";

export default async function ParametresMessageriePage() {
  const settings = await getSmtpSettings();
  return <SmtpForm settings={settings} />;
}
