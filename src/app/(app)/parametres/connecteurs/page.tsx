import { getSentinelleSettings } from "@/lib/settings";
import { SentinelleForm } from "@/components/settings-forms";

export default async function ParametresConnecteursPage() {
  const sentinelle = await getSentinelleSettings();
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Les <strong>connecteurs</strong> relient Sésame à d&apos;autres outils du
        système d&apos;information. Chaque connecteur s&apos;active indépendamment et
        se configure ici. D&apos;autres connecteurs viendront enrichir cette page.
      </p>

      <SentinelleForm settings={sentinelle} />
    </div>
  );
}
