export type AssetStatus = "official" | "missing";

export type AssetRef = {
  logoUrl?: string;
  assetStatus: AssetStatus;
};

export const gameAssets: Record<string, AssetRef> = {
  valorant: { assetStatus: "missing" },
  cs2: { assetStatus: "missing" },
  lol: { assetStatus: "missing" },
};

export const competitionAssets: Record<string, AssetRef> = {
  "VCT Americas": { assetStatus: "missing" },
  "VCT EMEA": { assetStatus: "missing" },
  "BLAST Premier": { assetStatus: "missing" },
  "LCK Summer": { assetStatus: "missing" },
};