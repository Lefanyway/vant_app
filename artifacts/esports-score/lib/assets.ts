export type AssetStatus = "official" | "missing";

export type AssetRef = {
  logoUrl?: string;
  assetStatus: AssetStatus;
  sourceUrl?: string;
};

export const gameAssets: Record<string, AssetRef> = {
  valorant: { assetStatus: "missing", sourceUrl: "https://www.riotgames.com/zh-hant/press/riot-games-assets" },
  cs2: { assetStatus: "missing", sourceUrl: "https://counter-strike.net/" },
  lol: { assetStatus: "missing", sourceUrl: "https://www.riotgames.com/zh-hant/press/riot-games-assets" },
};

export const competitionAssets: Record<string, AssetRef> = {
  "VCT Americas": { assetStatus: "missing" },
  "VCT EMEA": { assetStatus: "missing" },
  "BLAST Premier": { assetStatus: "missing" },
  "LCK Summer": { assetStatus: "missing" },
};