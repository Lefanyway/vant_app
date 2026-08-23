import manifest from "@/lib/esports-assets.json";
import generatedAssetRegistry from "@/lib/generatedAssetRegistry";

export type AssetEntityType = "game" | "team" | "competition";
export type AssetStatus = "resolved" | "missing" | "error";
export type AssetResult = { logoUrl?: string; logoSource?: number; source?: string; status: AssetStatus };

type ManifestEntry = { logo?: string; source?: string; status: AssetStatus };
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
};

export function resolveEsportsAsset({ type, name }: { type: AssetEntityType; name: string; game?: string }): AssetResult {
  const key = aliases[normalizeAssetName(name)] ?? normalizeAssetName(name);
  const entry = typedManifest[`${type}s` as keyof AssetManifest]?.[key];
  if (!entry) {
    if (__DEV__) console.warn(`Missing esports asset: ${name}`);
    return { status: "missing" };
  }
  if (entry.status === "error") return { logoUrl: entry.logo, source: entry.source, status: "error" };
  const logoSource = generatedAssetRegistry[`${type}:${key}`];
  if (entry.status === "resolved" && !logoSource) {
    if (__DEV__) console.warn(`Missing local esports asset: ${name}`);
    return { status: "missing", source: entry.source };
  }
  return { logoUrl: entry.logo, logoSource, source: entry.source, status: entry.status ?? "missing" };
}