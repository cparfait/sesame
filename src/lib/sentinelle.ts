import type { SentinelleSettings } from "./settings";

export type SentinelleApp = {
  externalId: string;
  nom: string;
  description: string | null;
  actif: boolean;
};

/**
 * Récupère le catalogue d'applications de Sentinelle (modèle Asset,
 * asset_type = "application") via son API :
 *   GET {url}/api/assets?type=application
 *   Authorization: Bearer <token>
 * Le blueprint Flask correspondant à installer côté Sentinelle est fourni
 * dans docs/sentinelle_api.py.
 */
export async function fetchSentinelleApplications(
  cfg: SentinelleSettings,
): Promise<SentinelleApp[]> {
  const url = `${cfg.url.replace(/\/$/, "")}/api/assets?type=application`;
  const res = await fetch(url, {
    headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(
      `Sentinelle a répondu HTTP ${res.status}${res.status === 401 ? " (jeton invalide ?)" : ""} sur ${url}`,
    );
  }
  const data: unknown = await res.json();
  const items = Array.isArray(data)
    ? data
    : ((data as { assets?: unknown[] }).assets ?? []);
  return (items as Record<string, unknown>[])
    .filter((a) => a && (a.name ?? a.nom))
    .map((a) => ({
      externalId: String(a.id),
      nom: String(a.name ?? a.nom),
      description: a.description ? String(a.description) : null,
      actif: a.is_active !== undefined ? Boolean(a.is_active) : true,
    }));
}
