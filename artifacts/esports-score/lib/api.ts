import { Image } from "expo-image";
import { resolveEsportsAsset } from "@/lib/assetResolver";
import type { Match, Team } from "@/lib/data";

type ApiTeam = { id: string; name: string; acronym?: string; logoUrl?: string; country?: string; gameId: string };
export type ApiPlayer = { id: string; name: string; fullName?: string; imageUrl?: string; country?: string; role?: string; status?: "player" | "coach" | "staff" };
export type ApiTeamDetails = ApiTeam & { website?: string; socials?: { platform: string; url: string }[]; roster?: ApiPlayer[] };
export type TeamNewsArticle = { id: string; title: string; url: string; publishedAt: string; source: string; imageUrl?: string; summary?: string };
export type TeamNewsResult = { articles: TeamNewsArticle[]; available: boolean; error?: string };
export type ApiCompetition = { id: string; name: string; region?: string; serieName?: string; logoUrl?: string; gameId?: string };
type ApiMatch = { id: string; gameId: string; competition: ApiCompetition; homeTeam: ApiTeam; awayTeam: ApiTeam; startTime: string | null; scheduledTime?: string | null; status: "scheduled" | "live" | "finished" | "cancelled" | "postponed"; bestOf?: 1 | 3 | 5; homeScore?: number; awayScore?: number; streams?: { url: string; language?: string; official?: boolean }[] };
type ApiMatchDetails = { match: ApiMatch; maps: { id: string; mapName?: string; mapNumber: number; homeScore?: number; awayScore?: number }[]; playerStats: unknown[]; economy: null; veto: null; headToHead: ApiMatch[]; recentMatches: { teamId: string; matches: ApiMatch[] }[]; capabilities: { maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean } };
type ApiStats = { maps: { id: string; mapName: string; mapNumber: number; homeScore?: number; awayScore?: number; status?: string }[]; playerStats: { playerId: string; playerName: string; teamId?: string; agent?: string; rating?: number; acs?: number; kills?: number; deaths?: number; assists?: number; kast?: number; adr?: number; headshotPercentage?: number; firstKills?: number; firstDeaths?: number }[]; economy?: { homeRoundsWon?: number; awayRoundsWon?: number; homePistolRoundsWon?: number; awayPistolRoundsWon?: number; homeAttackRoundsWon?: number; awayAttackRoundsWon?: number; homeDefenseRoundsWon?: number; awayDefenseRoundsWon?: number }; veto: { teamName: string; action: string; mapName: string }[]; headToHead: ApiMatch[]; recentMatches: { teamId: string; matches: ApiMatch[] }[] };
type ApiStatsResult = { stats: ApiStats | null; capabilities: { deepStats: boolean; maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean }; error?: string };
export type MatchDetails = { match: Match; maps: { id: string; mapName?: string; mapNumber: number; homeScore?: number; awayScore?: number }[]; playerStats: unknown[]; economy: null; veto: { teamName: string; action: string; mapName: string }[] | null; headToHead: Match[]; recentMatches: { teamId: string; matches: Match[] }[]; capabilities: { maps: boolean; playerStats: boolean; economy: boolean; veto: boolean; headToHead: boolean; recentMatches: boolean }; stats?: ApiStats };
export type ApiSearchResult = { type: "team" | "competition" | "game"; id: string; name: string; gameId?: string; logoUrl?: string; acronym?: string; countryName?: string; season?: string };

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message);
    this.name = "ApiError";
  }
}
const gameName = (id: string): Team["game"] => id === "cs2" ? "CS2" : id === "lol" ? "League of Legends" : "Valorant";
const absoluteLogo = (url?: string) => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url}${url.includes("/esports/assets/logo?") ? "&v=2" : ""}`;
};
const toTeam = (value: ApiTeam): Team => ({ id: value.id, name: value.name, short: value.acronym ?? value.name.slice(0, 3).toUpperCase(), color: "#4C8DFF", game: gameName(value.gameId), logoUrl: absoluteLogo(value.logoUrl), country: value.country });

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${baseUrl}/api${path}`, { signal: controller.signal });
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      // The API answers in English for logs; the app shows its own Portuguese message per status.
      const message = response.status === 404 ? "Não encontrado." : response.status === 429 ? "Muitas consultas agora. Tente de novo em instantes." : response.status >= 500 ? "O serviço de dados não respondeu. Tente de novo." : "Não foi possível carregar os dados.";
      throw new ApiError(message, response.status, retryable);
    }
    return await response.json() as T;
  } catch (error) {
    if (signal?.aborted || error instanceof ApiError) throw error;
    throw new ApiError("A conexão demorou demais.", 504, true);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function errorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message || message.length > 180 || /token|authorization|bearer|secret/i.test(message)) return fallback;
  return message;
}

export function toMatch(row: ApiMatch): Match {
  const start = row.startTime && Number.isFinite(Date.parse(row.startTime)) ? row.startTime : undefined;
  const format = row.bestOf === 1 || row.bestOf === 3 || row.bestOf === 5 ? `BO${row.bestOf}` as Match["format"] : undefined;
  const status = row.status === "live" ? "Live" : row.status === "finished" ? "Finished" : row.status === "cancelled" ? "Cancelled" : row.status === "postponed" ? "Postponed" : "Upcoming";
  return {
    id: row.id,
    startTime: start,
    scheduledTime: row.scheduledTime ?? undefined,
    game: gameName(row.gameId),
    tournament: row.competition.serieName ? `${row.competition.name} · ${row.competition.serieName}` : row.competition.name,
    competitionName: row.competition.name,
    stage: row.competition.serieName,
    competitionId: row.competition.id,
    competitionLogoUrl: absoluteLogo(row.competition.logoUrl),
    time: status === "Live" ? "Ao vivo" : start ? new Date(row.scheduledTime ?? start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "Horário não informado",
    status,
    teamA: toTeam(row.homeTeam),
    teamB: toTeam(row.awayTeam),
    scoreA: typeof row.homeScore === "number" ? row.homeScore : undefined,
    scoreB: typeof row.awayScore === "number" ? row.awayScore : undefined,
    format,
    detail: status === "Live" ? "Ao vivo" : start ? new Date(start).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Data não informada",
    streams: (row.streams ?? []).filter((stream) => stream.url.startsWith("https://")),
  };
}

export async function fetchMatches(game = "valorant", date = localDateKey(new Date()), signal?: AbortSignal) {
  const started = Date.now();
  const params = new URLSearchParams({ date, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, game });
  const rows = await request<ApiMatch[]>(`/matches?${params.toString()}`, signal);
  console.log(`[VANT] frontend received=${rows.length} game=${game ?? "all"} date=${date} ms=${Date.now() - started}`);
  const matches = rows.map(toMatch);
  warmMatchLogos(matches);
  return matches;
}

export async function fetchMatch(id: string, signal?: AbortSignal) { return toMatch(await request<ApiMatch>(`/matches/${encodeURIComponent(id)}`, signal)); }
export async function fetchMatchDetails(id: string, signal?: AbortSignal) {
  const details = await request<ApiMatchDetails>(`/matches/${encodeURIComponent(id)}/details`, signal);
  return {
    ...details,
    match: toMatch(details.match),
    headToHead: details.headToHead.map(toMatch),
    recentMatches: details.recentMatches.map((group) => ({ ...group, matches: group.matches.map(toMatch) })),
  };
}

export async function fetchMatchStats(id: string, signal?: AbortSignal) {
  try { return await request<ApiStatsResult>(`/matches/${encodeURIComponent(id)}/stats`, signal); }
  catch { return null; }
}

export function applyMatchStats(details: MatchDetails, statsResult: ApiStatsResult | null | undefined): MatchDetails {
  if (!statsResult?.capabilities.deepStats || !statsResult.stats) return details;
  const stats = statsResult.stats;
  return {
    ...details,
    maps: stats.maps?.length ? stats.maps : details.maps,
    playerStats: stats.playerStats ?? details.playerStats,
    economy: stats.economy ? null : details.economy,
    veto: stats.veto ?? details.veto,
    headToHead: stats.headToHead?.length ? stats.headToHead.map(toMatch) : details.headToHead,
    recentMatches: stats.recentMatches?.length ? stats.recentMatches.map((group) => ({ ...group, matches: group.matches.map(toMatch) })) : details.recentMatches,
    capabilities: { maps: statsResult.capabilities.maps, playerStats: statsResult.capabilities.playerStats, economy: statsResult.capabilities.economy, veto: statsResult.capabilities.veto, headToHead: statsResult.capabilities.headToHead, recentMatches: statsResult.capabilities.recentMatches },
    stats,
  };
}

export async function fetchLiveMatches(game = "valorant", signal?: AbortSignal) {
  return (await request<ApiMatch[]>(`/matches/live?game=${encodeURIComponent(game)}`, signal)).map(toMatch);
}

export async function fetchTeams(game = "valorant") {
  return (await request<ApiTeam[]>(`/teams?game=${encodeURIComponent(game)}`)).map(toTeam);
}

export async function fetchSearch(query: string) {
  return request<ApiSearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
}

export async function fetchCompetitions(game = "valorant") {
  return request<ApiCompetition[]>(`/competitions?game=${encodeURIComponent(game)}`);
}

export async function fetchCompetition(id: string) {
  return request<ApiCompetition>(`/competitions/${encodeURIComponent(id)}`);
}

export async function fetchCompetitionMatches(id: string, filter: "upcoming" | "finished", page = 1) {
  return request<TeamMatchesResult>(`/competitions/${encodeURIComponent(id)}/matches?filter=${filter}&page=${page}&per_page=20`);
}

export async function fetchTeam(id: string) {
  return toTeam(await request<ApiTeam>(`/teams/${encodeURIComponent(id)}`));
}

export async function fetchFollowedMatches(ids: string[]) {
  const results = await Promise.all(ids.map(async (id) => {
    try { return { ok: true as const, matches: (await fetchTeamMatches(id, "upcoming", 1)).matches.map(toMatch) }; }
    catch { return { ok: false as const, matches: [] as Match[] }; }
  }));
  if (ids.length > 0 && results.every((result) => !result.ok)) throw new Error("Não foi possível carregar as partidas seguidas.");
  const matches = [...new Map(results.flatMap((result) => result.matches).map((match) => [match.id, match])).values()];
  matches.sort((a, b) => (Date.parse(a.startTime ?? "") || 0) - (Date.parse(b.startTime ?? "") || 0) || a.id.localeCompare(b.id));
  return { matches, partial: results.some((result) => !result.ok) };
}

export type TeamOverview = {
  team: ApiTeamDetails;
  nextMatch: ApiMatch | null;
  recentMatches: ApiMatch[];
  competitions: ApiCompetition[];
  rosterPreview: ApiPlayer[];
  recentForm: ("W" | "L" | "D")[];
  capabilities: { overview: true; matches: boolean; roster: boolean; stats: boolean; news: boolean };
};
export type TeamStatsResult = { stats: { period: "30d"; matches: number; wins: number; losses: number; mapsPlayed?: number; mapsWon?: number; mapWinRate?: number } | null; available: boolean; error?: string };
export type TeamMatchesResult = { matches: ApiMatch[]; hasMore: boolean };

const playerPhoto = (player: ApiPlayer): ApiPlayer => ({ ...player, imageUrl: absoluteLogo(player.imageUrl) });
export async function fetchTeamOverview(id: string) {
  const overview = await request<TeamOverview>(`/teams/${encodeURIComponent(id)}/overview`);
  return {
    ...overview,
    team: { ...overview.team, logoUrl: absoluteLogo(overview.team.logoUrl), roster: overview.team.roster?.map(playerPhoto) },
    competitions: overview.competitions.map((competition) => ({ ...competition, logoUrl: absoluteLogo(competition.logoUrl) })),
    rosterPreview: overview.rosterPreview.map(playerPhoto),
  };
}
export async function fetchTeamNews(id: string, limit = 5) { return request<TeamNewsResult>(`/teams/${encodeURIComponent(id)}/news?limit=${limit}`); }
export async function fetchTeamMatches(id: string, filter: "all" | "upcoming" | "finished", page = 1) {
  return request<TeamMatchesResult>(`/teams/${encodeURIComponent(id)}/matches?filter=${filter}&page=${page}&per_page=20`);
}
export async function fetchTeamRoster(id: string) { return (await request<ApiPlayer[]>(`/teams/${encodeURIComponent(id)}/roster`)).map(playerPhoto); }
export async function fetchTeamStats(id: string) { return request<TeamStatsResult>(`/teams/${encodeURIComponent(id)}/stats`); }
export function toApiTeam(value: ApiTeamDetails): Team { return toTeam(value); }

export function fetchCatalogPage(type: "team" | "competition" | "all", page = 1, query = "", signal?: AbortSignal) {
 return request<{ items: ApiSearchResult[]; hasMore: boolean }>(`/catalog?type=${type}&page=${page}&q=${encodeURIComponent(query)}`, signal).then(result => ({ ...result, items: result.items.map(item => ({ ...item, logoUrl: absoluteLogo(item.logoUrl) })) }));
}

const warmedLogos = new Set<string>();
function warmMatchLogos(matches: Match[]) {
  const urls = new Set<string>();
  for (const match of matches) {
    for (const team of [match.teamA, match.teamB]) {
      if (team.logoUrl && !resolveEsportsAsset({ type: "team", name: team.name, entityId: team.id })?.logoSource) urls.add(team.logoUrl);
    }
    if (match.competitionLogoUrl && !resolveEsportsAsset({ type: "competition", name: match.competitionName || match.tournament, entityId: match.competitionId })?.logoSource) urls.add(match.competitionLogoUrl);
  }
  for (const url of urls) {
    if (warmedLogos.has(url)) continue;
    if (warmedLogos.size >= 512) warmedLogos.delete(warmedLogos.values().next().value!);
    warmedLogos.add(url);
    void Image.prefetch(url, { cachePolicy: "memory-disk" }).then(ok => { if (!ok) warmedLogos.delete(url); }).catch(() => warmedLogos.delete(url));
  }
}
