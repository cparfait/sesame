import { getGeneralSettings } from "@/lib/settings";
import { GeneralForm } from "@/components/settings-forms";

export default async function ParametresGeneralPage() {
  const settings = await getGeneralSettings();
  return <GeneralForm settings={settings} />;
}
