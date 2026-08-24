import type { Match, Team } from "@/lib/data";

type ApiTeam = { id: string; name: string; acronym?: string; logoUrl?: string; country?: string; gameId: string };
export type ApiPlayer = { id: string; name: string; fullName?: string; imageUrl?: string; country?: string; role?: string; status?: "player" | "coach" | "staff" };
export type ApiTeamDetails = ApiTeam & { website?: string; socials?: { platform: string; url: string }[]; roster?: ApiPlayer[] };
type ApiCompetition = { id: string; name: string; region?: string; serieName?: string; logoUrl?: string };
type ApiMatch = { id: string; gameId: string; competition: ApiCompetition; homeTeam: ApiTeam; awayTeam: ApiTeam; startTime: string; status: "scheduled" | "live" | "finished" | "cancelled" | "postponed"; bestOf?: 1 | 3 | 5; homeScore?: number; awayScore?: number; streams?: { url: string; language?: string; official?: boolean }[] };
type ApiMatchDetails = { match: ApiMatch; maps: { id: string; mapName?: string; mapNumber: number; homeScore?: number; awayScore?: number }[]; playerStats: unknown[]; economy: null; veto: null; headToHead: ApiMatch[]; recentMatches: { teamId: string; matches: ApiMatch[] }[]; capabilities: { maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean } };
type ApiStats = { maps: { id: string; mapName: string; mapNumber: number; homeScore?: number; awayScore?: number; status?: string }[]; playerStats: { playerId: string; playerName: string; teamId?: string; agent?: string; rating?: number; acs?: number; kills?: number; deaths?: number; assists?: number; kast?: number; adr?: number; headshotPercentage?: number; firstKills?: number; firstDeaths?: number }[]; economy?: { homeRoundsWon?: number; awayRoundsWon?: number; homePistolRoundsWon?: number; awayPistolRoundsWon?: number; homeAttackRoundsWon?: number; awayAttackRoundsWon?: number; homeDefenseRoundsWon?: number; awayDefenseRoundsWon?: number }; veto: { teamName: string; action: string; mapName: string }[]; headToHead: ApiMatch[]; recentMatches: { teamId: string; matches: ApiMatch[] }[] };
type ApiStatsResult = { stats: ApiStats | null; capabilities: { deepStats: boolean; maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean }; error?: string };
export type MatchDetails = { match: Match; maps: { id: string; mapName?: string; mapNumber: number; homeScore?: number; awayScore?: number }[]; playerStats: unknown[]; economy: null; veto: { teamName: string; action: string; mapName: string }[] | null; headToHead: Match[]; recentMatches: { teamId: string; matches: Match[] }[]; capabilities: { maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean }; stats?: ApiStats };
export type ApiSearchResult = { type: "team" | "competition" | "game"; id: string; name: string; gameId?: string; logoUrl?: string };

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const gameName = (id: string): Team["game"] => id === "cs2" ? "CS2" : id === "lol" ? "League of Legends" : "Valorant";
const absoluteLogo = (url?: string) => url ? `${baseUrl}${url}` : undefined;
const toTeam = (value: ApiTeam): Team => ({ id: value.id, name: value.name, short: value.acronym ?? value.name.slice(0, 3).toUpperCase(), color: "#4C8DFF", game: gameName(value.gameId), logoUrl: absoluteLogo(value.logoUrl), country: value.country });

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Couldn't load esports data."); }
  return response.json() as Promise<T>;
}

export function toMatch(row: ApiMatch): Match {
  return {
    id: row.id, startTime: row.startTime, game: gameName(row.gameId), tournament: row.competition.serieName ? `${row.competition.name} · ${row.competition.serieName}` : row.competition.name,
    competitionLogoUrl: absoluteLogo(row.competition.logoUrl),
    time: row.status === "live" ? "LIVE" : new Date(row.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: row.status === "live" ? "Live" : row.status === "finished" ? "Finished" : "Upcoming",
    teamA: toTeam(row.homeTeam), teamB: toTeam(row.awayTeam), scoreA: row.homeScore, scoreB: row.awayScore,
    format: row.bestOf === 1 ? "BO1" : row.bestOf === 5 ? "BO5" : "BO3",
    detail: row.status === "finished" ? "Final result" : row.status === "live" ? "Live now" : new Date(row.startTime).toLocaleDateString([], { day: "2-digit", month: "short" }),
    streams: row.streams,
  };
}

export async function fetchMatches(game?: string, date = localDateKey(new Date())) {
  const params = new URLSearchParams({ date, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  if (game) params.set("game", game);
  const rows = await request<ApiMatch[]>(`/matches?${params.toString()}`);
  console.log(`[VANT] frontend received=${rows.length} game=${game ?? "all"} date=${date}`);
  return rows.map(toMatch);
}

export async function fetchMatch(id: string) { return toMatch(await request<ApiMatch>(`/matches/${encodeURIComponent(id)}`)); }
export async function fetchMatchDetails(id: string) {
  const [details, statsResult] = await Promise.all([request<ApiMatchDetails>(`/matches/${encodeURIComponent(id)}/details`), request<ApiStatsResult>(`/matches/${encodeURIComponent(id)}/stats`)]);
  const stats = statsResult.stats ?? undefined;
  return {
    ...details, match: toMatch(details.match),
    maps: stats?.maps ?? details.maps,
    playerStats: stats?.playerStats ?? details.playerStats,
    economy: stats?.economy ? null : details.economy,
    veto: stats?.veto ?? details.veto,
    headToHead: (stats?.headToHead?.length ? stats.headToHead : details.headToHead).map(toMatch),
    recentMatches: (stats?.recentMatches?.length ? stats.recentMatches : details.recentMatches).map((group) => ({ ...group, matches: group.matches.map(toMatch) })),
    capabilities: statsResult.capabilities.deepStats ? { maps: statsResult.capabilities.maps, playerStats: statsResult.capabilities.playerStats, economy: statsResult.capabilities.economy, veto: statsResult.capabilities.veto, headToHead: statsResult.capabilities.headToHead, recentMatches: statsResult.capabilities.recentMatches } : details.capabilities,
    stats,
  };
}

export async function fetchLiveMatches(game?: string) {
  const suffix = game ? `?game=${encodeURIComponent(game)}` : "";
  return (await request<ApiMatch[]>(`/matches/live${suffix}`)).map(toMatch);
}

export async function fetchTeams(game?: string) {
  const suffix = game ? `?game=${encodeURIComponent(game)}` : "";
  return (await request<ApiTeam[]>(`/teams${suffix}`)).map(toTeam);
}

export async function fetchSearch(query: string) {
  return request<ApiSearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
}

export async function fetchCompetitions(game?: string) {
  const suffix = game ? `?game=${encodeURIComponent(game)}` : "";
  return request<ApiCompetition[]>(`/competitions${suffix}`);
}

export type TeamOverview = {
  team: ApiTeamDetails;
  nextMatch: ApiMatch | null;
  recentMatches: ApiMatch[];
  competitions: ApiCompetition[];
  rosterPreview: ApiPlayer[];
  recentForm: ("W" | "L" | "D")[];
  capabilities: { overview: true; matches: boolean; roster: boolean; stats: boolean; news: false };
};
export type TeamStatsResult = { stats: { period: "30d"; matches: number; wins: number; losses: number; mapsPlayed?: number; mapsWon?: number; mapWinRate?: number } | null; available: boolean; error?: string };
export type TeamMatchesResult = { matches: ApiMatch[]; hasMore: boolean };

export async function fetchTeamOverview(id: string) { return request<TeamOverview>(`/teams/${encodeURIComponent(id)}/overview`); }
export async function fetchTeamMatches(id: string, filter: "all" | "upcoming" | "finished", page = 1) {
  return request<TeamMatchesResult>(`/teams/${encodeURIComponent(id)}/matches?filter=${filter}&page=${page}&per_page=20`);
}
export async function fetchTeamRoster(id: string) { return request<ApiPlayer[]>(`/teams/${encodeURIComponent(id)}/roster`); }
export async function fetchTeamStats(id: string) { return request<TeamStatsResult>(`/teams/${encodeURIComponent(id)}/stats`); }
export function toApiTeam(value: ApiTeamDetails): Team { return toTeam(value); }
