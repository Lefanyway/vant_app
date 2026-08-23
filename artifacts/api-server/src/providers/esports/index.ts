import { PandaScoreAdapter } from "./pandascore/adapter";
import { PandaScoreClient } from "./pandascore/client";
import type { EsportsDataProvider } from "./types";

export function getConfiguredProvider(): { provider: EsportsDataProvider | null; name: string | null; configured: boolean } {
  if (process.env.PANDASCORE_API_TOKEN) return { provider: new PandaScoreAdapter(new PandaScoreClient(process.env.PANDASCORE_API_TOKEN)), name: "pandascore", configured: true };
  return { provider: null, name: null, configured: false };
}