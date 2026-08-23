import { PandaScoreClient } from "./client";
import type { Competition, EsportsDataProvider, Game, GameId, Match, MatchQuery, MatchStatus, ProviderCapabilities, SearchResult, Team } from "../types";
import { localDayBounds } from "../date";

type RawTeam = { id: number; name: string; acronym?: string; image_url?: string; location?: string };
type RawLeague = { id: number; name: string; slug?: string; image_url?: string };
type RawMatch = {
  id: number; begin_at?: string; status?: string; number_of_games?: number;
  opponents?: { opponent: RawTeam }[]; league?: RawLeague; serie?: { name?: string }; tournament?: { name?: string };
  videogame?: { slug?: string }; results?: { score: number; team_id: number }[];
  streams_list?: { raw_url?: string; language?: string; official?: boolean }[];
};

const games: Record<string, Game> = {
  valorant: { id: "valorant", name: "VALORANT", shortName: "VALORANT" },
  csgo: { id: "cs2", name: "Counter-Strike 2", shortName: "CS2" },
  lol: { id: "lol", name: "League of Legends", shortName: "LoL" },
};
const providerSlug: Record<GameId, string> = { valorant: "valorant", cs2: "csgo", lol: "lol" };
const vantGameId = (slug?: string): GameId => games[slug ?? ""]?.id ?? "valorant";
const internalId = (provider: string, id: number) => `${provider}:${id}`;

const logoProxy = (url?: string) => url ? `/api/esports/assets/logo?url=${encodeURIComponent(url)}` : undefined;
const mapTeam = (raw: RawTeam, game: GameId): Team => ({ id: internalId("pandascore", raw.id), externalIds: [{ provider: "pandascore", id: String(raw.id) }], name: raw.name, acronym: raw.acronym, logoUrl: logoProxy(raw.image_url), country: raw.location, gameId: game });
const tbdTeam = (matchId: number, side: "home" | "away", game: GameId): Team => ({ id: `tbd:${matchId}:${side}`, externalIds: [], name: "TBD", gameId: game });
const mapCompetition = (raw: RawLeague, game: GameId, serieName?: string): Competition => ({ id: internalId("pandascore", raw.id), externalIds: [{ provider: "pandascore", id: String(raw.id) }], name: raw.name, slug: raw.slug, logoUrl: logoProxy(raw.image_url), serieName, gameId: game });

const statusRank = (status: MatchStatus) => status === "live" ? 0 : status === "scheduled" ? 1 : 2;

export class PandaScoreAdapter implements EsportsDataProvider {
  name = "pandascore";
  capabilities: Record<GameId, ProviderCapabilities> = {
    valorant: { schedules: true, results: true, runningMatches: true, historicalStats: false, liveTelemetry: false },
    cs2: { schedules: true, results: true, runningMatches: true, historicalStats: false, liveTelemetry: false },
    lol: { schedules: true, results: true, runningMatches: true, historicalStats: false, liveTelemetry: false },
  };
  constructor(private readonly client: PandaScoreClient) {}

  async getGames() { return Object.values(games); }

  private mapMatch(row: RawMatch): Match {
    const game = vantGameId(row.videogame?.slug);
    const opponents = row.opponents ?? [];
    const home = opponents[0]?.opponent ? mapTeam(opponents[0].opponent, game) : tbdTeam(row.id, "home", game);
    const away = opponents[1]?.opponent ? mapTeam(opponents[1].opponent, game) : tbdTeam(row.id, "away", game);
    const competition = mapCompetition(row.league ?? { id: 0, name: row.tournament?.name ?? "Unknown competition" }, game, row.serie?.name);
    const status: MatchStatus = row.status === "running" ? "live" : row.status === "finished" ? "finished" : row.status === "canceled" ? "cancelled" : row.status === "postponed" ? "postponed" : "scheduled";
    return {
      id: internalId("pandascore", row.id), externalIds: [{ provider: "pandascore", id: String(row.id) }], gameId: game,
      competition, homeTeam: home, awayTeam: away, startTime: row.begin_at ?? new Date(0).toISOString(), status,
      bestOf: (row.number_of_games === 5 ? 5 : row.number_of_games === 1 ? 1 : 3) as 1 | 3 | 5,
      homeScore: row.results?.find((score) => score.team_id === opponents[0]?.opponent.id)?.score,
      awayScore: row.results?.find((score) => score.team_id === opponents[1]?.opponent.id)?.score,
      streams: (row.streams_list ?? []).filter((stream) => stream.raw_url).map((stream) => ({ url: stream.raw_url as string, language: stream.language, official: stream.official })),
    };
  }

  private async matchesForGame(game: GameId, range?: { start: string; end: string }, endpoint = "matches"): Promise<{ matches: Match[]; pages: number; raw: number }> {
    const { rows, pages } = await this.client.fetchAllPages<RawMatch>(`/${providerSlug[game]}/${endpoint}`, {
      sort: "begin_at", "range[begin_at]": range ? `${range.start},${range.end}` : undefined,
    });
    return { matches: rows.map((row) => this.mapMatch(row)), pages, raw: rows.length };
  }

  private targetGames(game?: GameId): GameId[] { return game ? [game] : ["valorant", "cs2", "lol"]; }

  async getMatches(query: MatchQuery = {}): Promise<Match[]> {
    const dayBounds = query.date ? localDayBounds(query.date, query.timezone) : undefined;
    const range = dayBounds ?? (query.from || query.to ? {
      start: query.from ? localDayBounds(query.from, query.timezone).start : new Date(0).toISOString(),
      end: query.to ? localDayBounds(query.to, query.timezone).end : new Date(8.64e15).toISOString(),
    } : undefined);
    const startedAt = Date.now();
    const parts = await Promise.all(this.targetGames(query.game).map((game) => this.matchesForGame(game, range)));
    const raw = parts.reduce((sum, part) => sum + part.raw, 0);
    const pages = parts.reduce((sum, part) => sum + part.pages, 0);
    const seen = new Set<string>();
    const normalized = parts.flatMap((part) => part.matches).filter((match) => {
      if (seen.has(match.id)) return false;
      seen.add(match.id);
      const time = Date.parse(match.startTime);
      return (!range || (time >= Date.parse(range.start) && time < Date.parse(range.end)));
    });
    normalized.sort((a, b) => {
      const rank = statusRank(a.status) - statusRank(b.status);
      if (rank !== 0) return rank;
      return a.status === "finished" ? Date.parse(b.startTime) - Date.parse(a.startTime) : Date.parse(a.startTime) - Date.parse(b.startTime);
    });
    console.log(`[VANT esports] provider=pandascore op=matches game=${query.game ?? "all"} date=${query.date ?? `${query.from ?? ""}..${query.to ?? ""}`} pages=${pages} raw=${raw} normalized=${normalized.length} duration=${Date.now() - startedAt}ms`);
    return normalized;
  }

  async getLiveMatches(game?: GameId): Promise<Match[]> {
    const parts = await Promise.all(this.targetGames(game).map((target) => this.matchesForGame(target, undefined, "matches/running")));
    const matches = parts.flatMap((part) => part.matches).filter((match) => match.status === "live");
    console.log(`[VANT esports] provider=pandascore op=live game=${game ?? "all"} raw=${parts.reduce((sum, part) => sum + part.raw, 0)} normalized=${matches.length}`);
    return matches.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  }

  async getUpcomingMatches(game?: GameId): Promise<Match[]> {
    const parts = await Promise.all(this.targetGames(game).map((target) => this.matchesForGame(target, undefined, "matches/upcoming")));
    return parts.flatMap((part) => part.matches).filter((match) => match.status === "scheduled").sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  }

  async getPastMatches(game?: GameId): Promise<Match[]> {
    const parts = await Promise.all(this.targetGames(game).map((target) => this.matchesForGame(target, undefined, "matches/past")));
    return parts.flatMap((part) => part.matches).filter((match) => match.status === "finished").sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  }

  async getMatch(id: string): Promise<Match | null> {
    const externalId = id.startsWith("pandascore:") ? id.slice("pandascore:".length) : id;
    try {
      const row = await this.client.request<RawMatch>(`/matches/${encodeURIComponent(externalId)}`);
      return this.mapMatch(row);
    } catch {
      return null;
    }
  }

  async getCompetitions(game?: GameId): Promise<Competition[]> {
    const parts = await Promise.all(this.targetGames(game).map(async (target) => {
      const { rows } = await this.client.fetchAllPages<RawLeague>(`/${providerSlug[target]}/leagues`, { sort: "name" }, 10);
      return rows.map((row) => mapCompetition(row, target));
    }));
    return parts.flat();
  }

  async getCompetition(id: string): Promise<Competition | null> {
    const externalId = id.startsWith("pandascore:") ? id.slice("pandascore:".length) : id;
    for (const target of ["valorant", "cs2", "lol"] as GameId[]) {
      try {
        const row = await this.client.request<RawLeague>(`/${providerSlug[target]}/leagues/${encodeURIComponent(externalId)}`);
        return mapCompetition(row, target);
      } catch { /* try next game */ }
    }
    return null;
  }

  async getTeams(game?: GameId): Promise<Team[]> {
    const parts = await Promise.all(this.targetGames(game).map(async (target) => {
      const { rows } = await this.client.fetchAllPages<RawTeam>(`/${providerSlug[target]}/teams`, { sort: "name" }, 10);
      return rows.map((row) => mapTeam(row, target));
    }));
    return parts.flat();
  }

  async getTeam(id: string): Promise<Team | null> {
    const externalId = id.startsWith("pandascore:") ? id.slice("pandascore:".length) : id;
    for (const target of ["valorant", "cs2", "lol"] as GameId[]) {
      try {
        const row = await this.client.request<RawTeam>(`/${providerSlug[target]}/teams/${encodeURIComponent(externalId)}`);
        return mapTeam(row, target);
      } catch { /* try next game */ }
    }
    return null;
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const parts = await Promise.all(this.targetGames().map(async (target) => {
      const [teams, leagues] = await Promise.all([
        this.client.request<RawTeam[]>(`/${providerSlug[target]}/teams`, { "search[name]": query, per_page: 20 }),
        this.client.request<RawLeague[]>(`/${providerSlug[target]}/leagues`, { "search[name]": query, per_page: 20 }),
      ]);
      return [
        ...teams.map((row): SearchResult => ({ type: "team", id: internalId("pandascore", row.id), name: row.name, gameId: target, logoUrl: logoProxy(row.image_url) })),
        ...leagues.map((row): SearchResult => ({ type: "competition", id: internalId("pandascore", row.id), name: row.name, gameId: target, logoUrl: logoProxy(row.image_url) })),
      ];
    }));
    const seen = new Set<string>();
    return parts.flat().filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
  }
}
