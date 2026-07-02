import { getSentinelleSettings } from "@/lib/settings";
import { SentinelleForm } from "@/components/settings-forms";

export default async function ParametresSentinellePage() {
  const settings = await getSentinelleSettings();
  return <SentinelleForm settings={settings} />;
}
