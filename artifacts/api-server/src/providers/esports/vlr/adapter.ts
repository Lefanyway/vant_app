import type { Match, Team, ValorantEconomy, ValorantMapStats, ValorantPlayerStats, ValorantProviderMatch, ValorantStatsProvider, ValorantVetoAction, VantValorantMatchStats } from "../types.ts";
import { VlrStatsClient } from "./client.ts";

type RawVlrMatch = { match_page?: string; team1?: string; team2?: string; unix_timestamp?: string; match_event?: string; match_series?: string };
type RawVlrDetail = { maps?: unknown; head_to_head?: unknown; performance?: unknown; economy?: unknown };

const normalized = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\besports?\b/g, "").replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = { kru: ["kru", "kruesports"], g2: ["g2", "g2esports"], sen: ["sen", "sentinels"] };
const namesMatch = (left: string, right: string) => {
  const a = normalized(left); const b = normalized(right);
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return Object.values(aliases).some((group) => group.includes(a) && group.includes(b));
};
export class VlrValorantStatsProvider implements ValorantStatsProvider {
  name = "vlr";
  constructor(private readonly client: VlrStatsClient) {}
  async health() { await this.client.health(); }

  async findMatch(input: { homeTeam: Team; awayTeam: Team; startTime: string; competition?: { name: string }; bestOf?: 1 | 3 | 5 }): Promise<ValorantProviderMatch | null> {
    const responses = await Promise.all(["upcoming", "live_score", "results"].map((query) => this.client.listMatches(query as "upcoming" | "live_score" | "results")));
    const rows = responses.flatMap((response) => Array.isArray(response.data?.segments) ? response.data.segments as RawVlrMatch[] : []);
    const row = rows.find((candidate) => {
      const direct = namesMatch(candidate.team1 ?? "", input.homeTeam.name) && namesMatch(candidate.team2 ?? "", input.awayTeam.name);
      const reversed = namesMatch(candidate.team1 ?? "", input.awayTeam.name) && namesMatch(candidate.team2 ?? "", input.homeTeam.name);
      const candidateTime = Date.parse(candidate.unix_timestamp ?? "");
      const inputTime = Date.parse(input.startTime);
      const closeInTime = Number.isNaN(candidateTime) || Number.isNaN(inputTime) || Math.abs(candidateTime - inputTime) < 36 * 60 * 60_000;
      return (direct || reversed) && closeInTime && (!input.competition || namesMatch(candidate.match_event ?? "", input.competition.name));
    });
    const providerMatchId = row?.match_page?.split("/").filter(Boolean)[0];
    return row && providerMatchId ? { providerMatchId, homeTeamName: row.team1 ?? "", awayTeamName: row.team2 ?? "", startTime: row.unix_timestamp ?? input.startTime, competitionName: row.match_event, bestOf: input.bestOf } : null;
  }

  async getMatchStats(providerMatchId: string): Promise<VantValorantMatchStats | null> {
    const response = await this.client.getMatchDetails(providerMatchId);
    const payload = response.data?.segments?.[0] as RawVlrDetail | undefined;
    if (!payload || typeof payload !== "object") return null;
    const maps = Array.isArray(payload.maps) ? payload.maps.map((map, index) => {
      const item = map as { map_name?: string; score?: { team1?: number; team2?: number } };
      return { id: `${providerMatchId}-${index + 1}`, mapName: item.map_name ?? "Unknown map", mapNumber: index + 1, homeScore: item.score?.team1, awayScore: item.score?.team2, status: "finished" as const };
    }) : [];
    return { maps, playerStats: [], economy: undefined, veto: [], headToHead: [], recentMatches: [] };
  }

  async getHeadToHead(): Promise<Match[]> { return []; }
  async getRecentMatches(): Promise<Match[]> { return []; }
}
