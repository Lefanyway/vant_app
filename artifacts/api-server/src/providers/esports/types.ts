export type GameId = "valorant" | "cs2" | "lol";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled" | "postponed";
export type ExternalId = { provider: string; id: string };
export type Game = { id: GameId; name: string; shortName: string; logoUrl?: string };
export type Team = { id: string; externalIds: ExternalId[]; name: string; acronym?: string; logoUrl?: string; country?: string; gameId: GameId };
export type Competition = { id: string; externalIds: ExternalId[]; name: string; slug?: string; logoUrl?: string; region?: string; gameId: GameId };
export type Match = {
  id: string; externalIds: ExternalId[]; gameId: GameId; competition: Competition;
  homeTeam: Team; awayTeam: Team; startTime: string; status: MatchStatus; bestOf?: 1 | 3 | 5;
  homeScore?: number; awayScore?: number; live?: { currentMap?: number; mapName?: string; homeRounds?: number; awayRounds?: number };
};
export type MatchQuery = { game?: GameId; date?: string; from?: string; to?: string; timezone?: string };
export type SearchResult = { type: "team" | "competition" | "game"; id: string; name: string; gameId?: GameId; logoUrl?: string };
export type EsportsDataProvider = {
  name: string;
  getGames(): Promise<Game[]>;
  getMatches(query?: MatchQuery): Promise<Match[]>;
  getLiveMatches(game?: GameId): Promise<Match[]>;
  getUpcomingMatches(game?: GameId): Promise<Match[]>;
  getPastMatches(game?: GameId): Promise<Match[]>;
  getMatch(id: string): Promise<Match | null>;
  getCompetitions(game?: GameId): Promise<Competition[]>;
  getCompetition(id: string): Promise<Competition | null>;
  getTeams(game?: GameId): Promise<Team[]>;
  getTeam(id: string): Promise<Team | null>;
  search(query: string): Promise<SearchResult[]>;
};