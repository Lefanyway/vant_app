import type { Match, Team } from "@/lib/data";

type ApiTeam = { id: string; name: string; acronym?: string; logoUrl?: string; country?: string; gameId: string };
type ApiCompetition = { id: string; name: string; region?: string; serieName?: string; logoUrl?: string };
type ApiMatch = { id: string; gameId: string; competition: ApiCompetition; homeTeam: ApiTeam; awayTeam: ApiTeam; startTime: string; status: "scheduled" | "live" | "finished" | "cancelled" | "postponed"; bestOf?: 1 | 3 | 5; homeScore?: number; awayScore?: number; streams?: { url: string; language?: string; official?: boolean }[] };
export type MatchDetails = { match: ApiMatch; maps: { id: string; mapName?: string; mapNumber: number; homeScore?: number; awayScore?: number }[]; playerStats: unknown[]; economy: null; veto: null; headToHead: ApiMatch[]; recentMatches: { teamId: string; matches: ApiMatch[] }[]; capabilities: { maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean } };
export type ApiSearchResult = { type: "team" | "competition" | "game"; id: string; name: string; gameId?: string; logoUrl?: string };

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const gameName = (id: string): Team["game"] => id === "cs2" ? "CS2" : id === "lol" ? "League of Legends" : "Valorant";
const absoluteLogo = (url?: string) => url ? `${baseUrl}${url}` : undefined;
const toTeam = (value: ApiTeam): Team => ({ id: value.id, name: value.name, short: value.acronym ?? value.name.slice(0, 3).toUpperCase(), color: "#4C8DFF", game: gameName(value.gameId), logoUrl: absoluteLogo(value.logoUrl) });

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Couldn't load esports data."); }
  return response.json() as Promise<T>;
}

export function toMatch(row: ApiMatch): Match {
  return {
    id: row.id, game: gameName(row.gameId), tournament: row.competition.serieName ? `${row.competition.name} · ${row.competition.serieName}` : row.competition.name,
    competitionLogoUrl: absoluteLogo(row.competition.logoUrl),
    time: row.status === "live" ? "LIVE" : new Date(row.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: row.status === "live" ? "Live" : row.status === "finished" ? "Finished" : "Upcoming",
    teamA: toTeam(row.homeTeam), teamB: toTeam(row.awayTeam), scoreA: row.homeScore, scoreB: row.awayScore,
    format: row.bestOf === 1 ? "BO1" : row.bestOf === 5 ? "BO5" : "BO3",
    detail: row.status === "finished" ? "Final result" : row.status === "live" ? "Live now" : new Date(row.startTime).toLocaleDateString([], { day: "2-digit", month: "short" }),
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
  const details = await request<MatchDetails>(`/matches/${encodeURIComponent(id)}/details`);
  return { ...details, match: toMatch(details.match), headToHead: details.headToHead.map(toMatch), recentMatches: details.recentMatches.map((group) => ({ ...group, matches: group.matches.map(toMatch) })) };
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
