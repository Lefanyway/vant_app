import manifest from "@/lib/esports-assets.json";
import generatedAssetRegistry from "@/lib/generatedAssetRegistry";

export type AssetEntityType = "game" | "team" | "competition" | "player";
export type AssetStatus = "resolved" | "missing" | "error";
export type AssetResult = { logoUrl?: string; logoSource?: number; source?: string; background?: string; status: AssetStatus };

type ManifestEntry = { logo?: string; source?: string; background?: string; ids?: string[]; status: AssetStatus };
type AssetManifest = { games: Record<string, ManifestEntry>; teams: Record<string, ManifestEntry>; competitions: Record<string, ManifestEntry> };

const typedManifest = manifest as AssetManifest;

export function normalizeAssetName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const aliases: Record<string, string> = {
  "league-of-legends": "lol",
  league: "lol",
  "counter-strike-2": "cs2",
  "counter-strike": "cs2",
  valorant: "valorant",
  "100t": "100-thieves",
  kru: "kru-esports",
  "g2": "g2-esports",
  "nrg-esports": "nrg",
  "natus-vincere": "navi",
  "drx": "kiwoom-drx",
  "geng": "gen-g",
  "vitality": "team-vitality",
};

export function resolveEsportsAsset({ type, name, entityId }: { type: AssetEntityType; name: string; game?: string; entityId?: string }): AssetResult {
  if (type === "player") return { status: "missing" };
  const normalized = normalizeAssetName(name);
  const entries = typedManifest[`${type}s` as keyof AssetManifest];
  const idKey = entityId ? Object.keys(entries ?? {}).find(key => entries[key].ids?.includes(entityId)) : undefined;
  const prefixKey = type === "competition" ? Object.keys(entries ?? {}).filter(key => normalized.startsWith(key + "-") && entries[key].status === "resolved").sort((a, b) => b.length - a.length)[0] : undefined;
  const key = idKey ?? aliases[normalized] ?? (entries?.[normalized]?.status === "resolved" ? normalized : prefixKey) ?? normalized;
  const entry = entries?.[key];
  if (!entry) {
    return { status: "missing" };
  }
  if (entry.status === "error") return { logoUrl: entry.logo, source: entry.source, status: "error" };
  const logoSource = generatedAssetRegistry[`${type}:${key}`];
  if (entry.status === "resolved" && !logoSource) {
    if (__DEV__) console.warn(`Missing local esports asset: ${name}`);
    return { status: "missing", source: entry.source };
  }
  return { logoUrl: entry.logo, logoSource, source: entry.source, background: entry.background, status: entry.status ?? "missing" };
}
