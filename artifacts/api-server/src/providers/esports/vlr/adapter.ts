import type { Match, Team, ValorantEconomy, ValorantMapStats, ValorantPlayerStats, ValorantProviderMatch, ValorantStatsProvider, ValorantVetoAction, VantValorantMatchStats } from "../types";
import { VlrStatsClient } from "./client";

type RawVlrMatch = { id: string | number; home_team?: string; away_team?: string; start_time?: string; competition?: string; best_of?: number };
type RawVlrStats = { maps?: ValorantMapStats[]; players?: ValorantPlayerStats[]; playerStats?: ValorantPlayerStats[]; economy?: ValorantEconomy; veto?: ValorantVetoAction[]; headToHead?: Match[]; recentMatches?: { teamId: string; matches: Match[] }[] };

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
    const rows = await this.client.request<RawVlrMatch[]>("/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeTeam: input.homeTeam.name, awayTeam: input.awayTeam.name, startTime: input.startTime, competition: input.competition?.name, bestOf: input.bestOf }) });
    const row = rows.find((candidate) => namesMatch(candidate.home_team ?? "", input.homeTeam.name) && namesMatch(candidate.away_team ?? "", input.awayTeam.name) && Math.abs(Date.parse(candidate.start_time ?? "") - Date.parse(input.startTime)) < 36 * 60 * 60_000);
    return row ? { providerMatchId: String(row.id), homeTeamName: row.home_team ?? "", awayTeamName: row.away_team ?? "", startTime: row.start_time ?? input.startTime, competitionName: row.competition, bestOf: row.best_of as 1 | 3 | 5 | undefined } : null;
  }

  async getMatchStats(providerMatchId: string): Promise<VantValorantMatchStats | null> {
    const raw = await this.client.request<RawVlrStats>(`/matches/${encodeURIComponent(providerMatchId)}/stats`);
    if (!raw) return null;
    return { providerMatchId, maps: raw.maps ?? [], playerStats: raw.playerStats ?? raw.players ?? [], economy: raw.economy, veto: raw.veto ?? [], headToHead: raw.headToHead ?? [], recentMatches: raw.recentMatches ?? [] };
  }

  async getHeadToHead(): Promise<Match[]> { return []; }
  async getRecentMatches(): Promise<Match[]> { return []; }
}
