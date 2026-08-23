import type { Match, Team } from "@/lib/data";

type ApiTeam = { id: string; name: string; acronym?: string; logoUrl?: string; gameId: string };
type ApiMatch = { id: string; gameId: string; competition: { name: string }; homeTeam: ApiTeam; awayTeam: ApiTeam; startTime: string; status: "scheduled" | "live" | "finished" | "cancelled" | "postponed"; bestOf?: 1 | 3 | 5; homeScore?: number; awayScore?: number };
type ApiCompetition = { name: string; region?: string };

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const gameName = (id: string): Team["game"] => id === "cs2" ? "CS2" : id === "lol" ? "League of Legends" : "Valorant";
const team = (value: ApiTeam): Team => ({ id: value.id, name: value.name, short: value.acronym ?? value.name.slice(0, 3).toUpperCase(), color: "#4C8DFF", game: gameName(value.gameId) });

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Couldn't load esports data.");
  }
  return response.json() as Promise<T>;
}

export async function fetchMatches(game?: string, date = new Date().toISOString().slice(0, 10)) {
  const params = new URLSearchParams({ date, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  if (game) params.set("game", game);
  const rows = await request<ApiMatch[]>(`/matches?${params.toString()}`);
  return rows.map((row): Match => ({ id: row.id, game: gameName(row.gameId), tournament: row.competition.name, time: row.status === "live" ? "LIVE" : new Date(row.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: row.status === "live" ? "Live" : row.status === "finished" ? "Finished" : "Upcoming", teamA: team(row.homeTeam), teamB: team(row.awayTeam), scoreA: row.homeScore, scoreB: row.awayScore, format: row.bestOf === 1 ? "BO1" : row.bestOf === 5 ? "BO5" : "BO3", detail: row.status === "finished" ? "Final result" : row.status === "live" ? "Live now" : "Scheduled" }));
}

export async function fetchCompetitions(game?: string) {
  const suffix = game ? `?game=${encodeURIComponent(game)}` : "";
  return request<ApiCompetition[]>(`/competitions${suffix}`);
}