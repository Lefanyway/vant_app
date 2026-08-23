import { PandaScoreClient } from "./client";
import type { Competition, EsportsDataProvider, Game, GameId, Match, MatchQuery, MatchStatus, SearchResult, Team } from "../types";
import { localDayBounds } from "../date";

type RawTeam = { id: number; name: string; acronym?: string; image_url?: string; location?: string };
type RawLeague = { id: number; name: string; slug?: string; image_url?: string };
type RawMatch = { id: number; begin_at?: string; status?: string; number_of_games?: number; opponents?: { opponent: RawTeam }[]; league?: RawLeague; tournament?: { name?: string }; videogame?: { slug?: string }; results?: { score: number; team_id: number }[] };
const games: Record<string, Game> = { valorant: { id: "valorant", name: "VALORANT", shortName: "VALORANT" }, csgo: { id: "cs2", name: "Counter-Strike 2", shortName: "CS2" }, "league-of-legends": { id: "lol", name: "League of Legends", shortName: "LoL" } };
const gameId = (slug?: string): GameId => games[slug ?? ""]?.id ?? "valorant";
const internalId = (provider: string, id: number) => `${provider}:${id}`;

const cachedLogoUrl = (url?: string) => url ? `/api/esports/assets/logo?url=${encodeURIComponent(url)}` : undefined;
const mapTeam = (raw: RawTeam, game: GameId): Team => ({ id: internalId("pandascore", raw.id), externalIds: [{ provider: "pandascore", id: String(raw.id) }], name: raw.name, acronym: raw.acronym, logoUrl: cachedLogoUrl(raw.image_url), country: raw.location, gameId: game });
const mapCompetition = (raw: RawLeague, game: GameId): Competition => ({ id: internalId("pandascore", raw.id), externalIds: [{ provider: "pandascore", id: String(raw.id) }], name: raw.name, slug: raw.slug, logoUrl: cachedLogoUrl(raw.image_url), gameId: game });

export class PandaScoreAdapter implements EsportsDataProvider {
  name = "pandascore";
  constructor(private readonly client: PandaScoreClient) {}
  async getGames() { return Object.values(games); }
  async getMatches(query: MatchQuery = {}): Promise<Match[]> {
    const dayBounds = query.date ? localDayBounds(query.date, query.timezone) : undefined;
    const rows: RawMatch[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const chunk = await this.client.request<RawMatch[]>("/matches", {
        sort: "begin_at", page, per_page: 100, "begin_at[gte]": query.from ? localDayBounds(query.from, query.timezone).start : dayBounds?.start,
        "begin_at[lte]": query.to ? localDayBounds(query.to, query.timezone).end : dayBounds?.end,
      });
      rows.push(...chunk);
      if (chunk.length < 100) break;
    }
    const start = query.from ? Date.parse(localDayBounds(query.from, query.timezone).start) : dayBounds ? Date.parse(dayBounds.start) : undefined;
    const end = query.to ? Date.parse(localDayBounds(query.to, query.timezone).end) : dayBounds ? Date.parse(dayBounds.end) : undefined;
    const normalized = rows.filter((row) => !query.game || gameId(row.videogame?.slug) === query.game).map((row) => {
      const game = gameId(row.videogame?.slug); const opponents = row.opponents ?? []; const home = mapTeam(opponents[0]?.opponent ?? { id: 0, name: "Unknown" }, game); const away = mapTeam(opponents[1]?.opponent ?? { id: 0, name: "Unknown" }, game);
      const competition = mapCompetition(row.league ?? { id: 0, name: row.tournament?.name ?? "Unknown" }, game);
      const status: MatchStatus = row.status === "running" ? "live" : row.status === "finished" ? "finished" : row.status === "canceled" ? "cancelled" : row.status === "postponed" ? "postponed" : "scheduled";
      return { id: internalId("pandascore", row.id), externalIds: [{ provider: "pandascore", id: String(row.id) }], gameId: game, competition, homeTeam: home, awayTeam: away, startTime: row.begin_at ?? new Date(0).toISOString(), status, bestOf: (row.number_of_games === 5 ? 5 : row.number_of_games === 1 ? 1 : 3) as 1 | 3 | 5, homeScore: row.results?.find((score) => score.team_id === opponents[0]?.opponent.id)?.score, awayScore: row.results?.find((score) => score.team_id === opponents[1]?.opponent.id)?.score };
    }).filter((match) => (start === undefined || Date.parse(match.startTime) >= start) && (end === undefined || Date.parse(match.startTime) < end));
    return normalized.sort((a, b) => {
      const rank = (status: MatchStatus) => status === "live" ? 0 : status === "scheduled" ? 1 : 2;
      return rank(a.status) - rank(b.status) || Date.parse(a.startTime) - Date.parse(b.startTime);
    });
  }
  async getLiveMatches(game?: GameId) { return (await this.getMatches({ game })).filter((match) => match.status === "live"); }
  async getUpcomingMatches(game?: GameId) { return (await this.getMatches({ game })).filter((match) => match.status === "scheduled"); }
  async getPastMatches(game?: GameId) { return (await this.getMatches({ game })).filter((match) => match.status === "finished"); }
  async getMatch(id: string) { return (await this.getMatches()).find((match) => match.id === id) ?? null; }
  async getCompetitions(game?: GameId) { const rows = await this.client.request<RawLeague[]>("/leagues", { per_page: 100 }); return rows.map((row) => mapCompetition(row, game ?? "valorant")).filter((item) => !game || item.gameId === game); }
  async getCompetition(id: string) { return (await this.getCompetitions()).find((item) => item.id === id) ?? null; }
  async getTeams(game?: GameId) { const rows = await this.client.request<RawTeam[]>("/teams", { per_page: 100 }); return rows.map((row) => mapTeam(row, game ?? "valorant")).filter((item) => !game || item.gameId === game); }
  async getTeam(id: string) { return (await this.getTeams()).find((item) => item.id === id) ?? null; }
  async search(query: string) { const normalized = query.toLowerCase(); const [teams, competitions] = await Promise.all([this.getTeams(), this.getCompetitions()]); return [...teams.filter((item) => item.name.toLowerCase().includes(normalized)).map((item): SearchResult => ({ type: "team", id: item.id, name: item.name, gameId: item.gameId, logoUrl: item.logoUrl })), ...competitions.filter((item) => item.name.toLowerCase().includes(normalized)).map((item): SearchResult => ({ type: "competition", id: item.id, name: item.name, gameId: item.gameId, logoUrl: item.logoUrl }))]; }
}
