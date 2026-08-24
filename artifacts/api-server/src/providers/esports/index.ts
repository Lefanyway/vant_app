import { PandaScoreAdapter } from "./pandascore/adapter";
import { PandaScoreClient } from "./pandascore/client";
import { VlrStatsClient } from "./vlr/client";
import { VlrValorantStatsProvider } from "./vlr/adapter";
import type { EsportsDataProvider } from "./types";

export function getConfiguredProvider(): { provider: EsportsDataProvider | null; name: string | null; configured: boolean } {
  if (process.env.PANDASCORE_API_TOKEN) return { provider: new PandaScoreAdapter(new PandaScoreClient(process.env.PANDASCORE_API_TOKEN)), name: "pandascore", configured: true };
  return { provider: null, name: null, configured: false };
}

export function getConfiguredStatsProvider(): VlrValorantStatsProvider | null {
  const baseUrl = process.env.VLR_API_BASE_URL?.trim();
  return baseUrl ? new VlrValorantStatsProvider(new VlrStatsClient(baseUrl)) : null;
}