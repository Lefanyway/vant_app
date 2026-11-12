import { PandaScoreClient } from './client';
import { ProviderError, isProviderNotFound } from '../errors';
import { localDayBounds } from '../date';
import { fetchTeamNews } from './news';
import { countryName, hasWholeWords, rankResults, slugify } from '../search-rank';
import type { CatalogType, Competition, EsportsDataProvider, Game, GameId, Match, MatchDetails, MatchQuery, MatchStatus, ProviderCapabilities, SearchResult, Team, TeamDetails, TeamMatchFilter, TeamNewsArticle, TeamPlayer, TeamStats } from '../types';

type RawGame = { slug?: string };
export type RawPlayer = { id: number; name?: string; first_name?: string; last_name?: string; image_url?: string; nationality?: string; role?: string };
export type RawTeam = { id: number; name: string; acronym?: string; image_url?: string; location?: string; players?: RawPlayer[]; website?: string; social?: { url?: string }; current_videogame?: RawGame; videogame?: RawGame };
type RawLeague = { id: number; name: string; slug?: string; image_url?: string; videogame?: RawGame; series?: { full_name?: string; begin_at?: string | null }[] };
type RawSerie = { full_name?: string; begin_at?: string | null; league?: RawLeague };
export type RawMatch = { id: number; begin_at?: string | null; scheduled_at?: string | null; status?: string; number_of_games?: number; opponents?: { opponent?: RawTeam }[]; league?: RawLeague; serie?: { name?: string; full_name?: string }; tournament?: { name?: string }; videogame?: RawGame; results?: { score: number; team_id: number }[]; streams_list?: { raw_url?: string; language?: string; official?: boolean }[]; games?: { id: number; position?: number }[] };
const games: Game[] = [{ id: 'valorant', name: 'VALORANT', shortName: 'VALORANT' }, { id: 'cs2', name: 'Counter-Strike 2', shortName: 'CS2' }, { id: 'lol', name: 'League of Legends', shortName: 'LoL' }];
const slugs: Record<string, GameId> = { valorant: 'valorant', 'cs-go': 'cs2', 'league-of-legends': 'lol' };
const providerSlug: Record<GameId, string> = { valorant: 'valorant', cs2: 'csgo', lol: 'lol' };
const gameFrom = (raw?: RawGame): GameId | undefined => slugs[raw?.slug ?? ''];
const id = (value: number) => `pandascore:${value}`;
const external = (value: string) => {
  const result = value.startsWith('pandascore:') ? value.slice(11) : value;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(result)) throw new ProviderError('INVALID_ID', 'Invalid esports identifier', 400);
  return result;
};
const logo = (url?: string) => url ? `/api/esports/assets/logo?url=${encodeURIComponent(url)}` : undefined;
const mapTeam = (raw: RawTeam, game: GameId): Team => ({ id: id(raw.id), externalIds: [{ provider: 'pandascore', id: String(raw.id) }], name: raw.name, acronym: raw.acronym, logoUrl: logo(raw.image_url), country: raw.location, gameId: game });
export const mapPlayer = (raw: RawPlayer): TeamPlayer => ({ id: id(raw.id), name: raw.name || [raw.first_name, raw.last_name].filter(Boolean).join(' ') || 'Unknown player', fullName: [raw.first_name, raw.last_name].filter(Boolean).join(' ') || undefined, imageUrl: logo(raw.image_url), country: raw.nationality, role: raw.role, status: raw.role?.toLowerCase().includes('coach') ? 'coach' : 'player' });
const mapCompetition = (raw: RawLeague, game: GameId, serieName?: string): Competition => ({ id: id(raw.id), externalIds: [{ provider: 'pandascore', id: String(raw.id) }], name: raw.name, slug: raw.slug, logoUrl: logo(raw.image_url), serieName, gameId: game });
const timestamp = (match: Match) => match.startTime ? Date.parse(match.startTime) : Number.POSITIVE_INFINITY;
const rank = (match: Match) => match.status === 'live' ? 0 : match.status === 'scheduled' ? 1 : 2;
const confirmedScores = (status: MatchStatus, homeScore?: number, awayScore?: number) => {
  if (homeScore === undefined || awayScore === undefined) return {};
  if (status === 'live') return { homeScore, awayScore };
  if (status === 'finished' && !(homeScore === 0 && awayScore === 0)) return { homeScore, awayScore };
  return {};
};
const statusFilter = (filter: TeamMatchFilter) => filter === 'upcoming' ? 'not_started,running,postponed' : filter === 'finished' ? 'finished' : undefined;
const requireArray = <T>(value: T[]): T[] => { if (!Array.isArray(value)) throw new ProviderError('PROVIDER_INVALID_DATA', 'Esports provider returned an invalid list'); return value; };
const catalogTeam = (row: RawTeam): SearchResult => ({ type: 'team', id: id(row.id), name: row.name.trim(), gameId: 'valorant', logoUrl: logo(row.image_url), acronym: row.acronym || undefined, country: row.location || undefined, countryName: countryName(row.location) });
const catalogLeague = (row: RawLeague, season?: string): SearchResult => {
  const latest = [...(row.series ?? [])].sort((a, b) => Date.parse(a.begin_at ?? '') - Date.parse(b.begin_at ?? '')).at(-1);
  return { type: 'competition', id: id(row.id), name: row.name.trim(), gameId: 'valorant', logoUrl: logo(row.image_url), season: season || latest?.full_name || undefined };
};
// Several lookups feed one search; it fails only when every lookup failed.
const settledRows = <T>(results: PromiseSettledResult<T[]>[]): T[] => {
  const rows = results.flatMap(result => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (!rows.length && failure) throw failure.reason;
  return rows;
};

export class PandaScoreAdapter implements EsportsDataProvider {
  name = 'pandascore';
  capabilities: Record<GameId, ProviderCapabilities> = Object.fromEntries(games.map(game => [game.id, { schedules: true, results: true, runningMatches: true, historicalStats: false, liveTelemetry: false }])) as Record<GameId, ProviderCapabilities>;
  constructor(private readonly client: PandaScoreClient) {}
  // Search returns one ranked page: the best matches matter, not an alphabetical walk through thousands of teams.
  async getCatalogPage(type: CatalogType, page: number, query: string) {
    const q = query.trim();
    if (page > 1) return { items: [], hasMore: false };
    if (!q) return { items: await this.featured(type), hasMore: false };
    const [teams, leagues, series] = await Promise.all([
      type === 'competition' ? [] : this.lookup<RawTeam>('teams', q),
      type === 'team' ? [] : this.lookup<RawLeague>('leagues', q),
      // "Game Changers", "Champions" and "Masters" are seasons inside the VCT league, not leagues of their own.
      type === 'team' ? [] : this.client.request<RawSerie[]>('/valorant/series', { 'search[name]': q, per_page: 50, sort: '-begin_at' }).catch(() => [] as RawSerie[]),
    ]);
    // One entry per league: the newest season that has the query as whole words, else the newest that matched at all.
    const seasonRows = (Array.isArray(series) ? [...series] : []).sort((a, b) => Number(hasWholeWords(b.full_name ?? '', q)) - Number(hasWholeWords(a.full_name ?? '', q)));
    const seasons = seasonRows.flatMap(row => row.league ? [catalogLeague(row.league, row.full_name)] : []);
    return { items: rankResults([...teams.map(row => catalogTeam(row)), ...seasons, ...leagues.map(row => catalogLeague(row))], q), hasMore: false };
  }
  // By name, by ASCII slug (finds "KRÜ" from "kru") and, for teams, by exact acronym ("TL", "FNC").
  private async lookup<T>(entity: 'teams' | 'leagues', query: string): Promise<T[]> {
    const path = `/valorant/${entity}`;
    const slug = slugify(query);
    return settledRows(await Promise.allSettled([
      this.client.request<T[]>(path, { 'search[name]': query, per_page: 50 }),
      ...(slug ? [this.client.request<T[]>(path, { 'search[slug]': slug, per_page: 50 })] : []),
      ...(entity === 'teams' && /^[a-z0-9.]{1,6}$/i.test(query) ? [this.client.request<T[]>(path, { 'filter[acronym]': query.toUpperCase(), per_page: 20 })] : []),
    ]));
  }
  // With nothing typed: competitions and teams playing now, next and most recently, instead of an alphabetical wall.
  private async featured(type: CatalogType): Promise<SearchResult[]> {
    const rows = settledRows(await Promise.allSettled([
      this.client.request<RawMatch[]>('/valorant/matches/running', { per_page: 50 }),
      this.client.request<RawMatch[]>('/valorant/matches/upcoming', { per_page: 50, sort: 'begin_at' }),
      this.client.request<RawMatch[]>('/valorant/matches/past', { per_page: 50, sort: '-begin_at' }),
    ]));
    const leagues = type === 'team' ? [] : rows.flatMap(row => row.league ? [catalogLeague(row.league, row.serie?.full_name || row.serie?.name)] : []);
    const teams = type === 'competition' ? [] : rows.flatMap(row => (row.opponents ?? []).flatMap(side => side.opponent ? [catalogTeam(side.opponent)] : []));
    return [...new Map([...leagues, ...teams].map(item => [`${item.type}:${item.id}`, item])).values()].slice(0, 40);
  }
  async getGames() { return games; }
  async health() { requireArray(await this.client.request<RawMatch[]>('/matches/upcoming', { per_page: 1 })); }
  private targetGames(game?: GameId): GameId[] {
    if (game && game !== 'valorant') {
      console.log(`[VANT esports] op=skip-game game=${game} reason=phase_valorant_only permission=not_requested`);
      return [];
    }
    return ['valorant'];
  }
  mapMatch(row: RawMatch, knownGame?: GameId): Match | null {
    const game = gameFrom(row.videogame) ?? knownGame;
    if (!Number.isFinite(row.id)) throw new ProviderError('PROVIDER_INVALID_DATA', 'Esports provider returned an unsupported match');
    if (game !== 'valorant') {
      console.log(`[VANT esports] op=skip-match id=${row.id} game=${game ?? 'unknown'} reason=phase_valorant_only permission=not_requested`);
      return null;
    }
    const opponents = row.opponents ?? [];
    const tbd = (side: string): Team => ({ id: `tbd:${row.id}:${side}`, externalIds: [], name: 'TBD', gameId: game });
    const statuses: Record<string, MatchStatus> = { running: 'live', finished: 'finished', canceled: 'cancelled', cancelled: 'cancelled', postponed: 'postponed', not_started: 'scheduled' };
    const status = statuses[row.status ?? ''];
    if (!status) throw new ProviderError('PROVIDER_INVALID_DATA', 'Esports provider returned an unsupported match status');
    const startTime = row.begin_at && Number.isFinite(Date.parse(row.begin_at)) ? new Date(row.begin_at).toISOString() : null;
    const stage = [row.serie?.name, row.tournament?.name].filter((part): part is string => Boolean(part)).filter((part, index, all) => all.indexOf(part) === index).join(' · ');
    const scores = confirmedScores(status, row.results?.find(score => score.team_id === opponents[0]?.opponent?.id)?.score, row.results?.find(score => score.team_id === opponents[1]?.opponent?.id)?.score);
    return {
      id: id(row.id), externalIds: [{ provider: 'pandascore', id: String(row.id) }], gameId: game,
      competition: row.league ? mapCompetition(row.league, game, stage || undefined) : { id: `unknown:${row.id}`, externalIds: [], name: row.tournament?.name ?? 'Competition unavailable', gameId: game },
      homeTeam: opponents[0]?.opponent ? mapTeam(opponents[0].opponent, game) : tbd('home'),
      awayTeam: opponents[1]?.opponent ? mapTeam(opponents[1].opponent, game) : tbd('away'), startTime, scheduledTime: row.scheduled_at && Number.isFinite(Date.parse(row.scheduled_at)) ? new Date(row.scheduled_at).toISOString() : null, status,
      bestOf: [1, 3, 5].includes(row.number_of_games ?? 0) ? row.number_of_games as 1 | 3 | 5 : undefined,
      ...scores,
      streams: (row.streams_list ?? []).filter(stream => stream.raw_url?.startsWith('https://')).map(stream => ({ url: stream.raw_url!, language: stream.language, official: stream.official })),
    };
  }
  private async matchesForGame(game: GameId, range?: { start: string; end: string }, endpoint = 'matches') {
    const { rows } = await this.client.fetchAllPages<RawMatch>(`/${providerSlug[game]}/${endpoint}`, { sort: 'begin_at', 'range[begin_at]': range ? `${range.start},${range.end}` : undefined });
    return rows.flatMap(row => { const match = this.mapMatch(row, game); return match ? [match] : []; });
  }
  async getMatches(query: MatchQuery = {}): Promise<Match[]> {
    const range = query.date ? localDayBounds(query.date, query.timezone) : query.from || query.to ? { start: query.from ? localDayBounds(query.from, query.timezone).start : '1970-01-01T00:00:00.000Z', end: query.to ? localDayBounds(query.to, query.timezone).end : '9999-12-31T23:59:59.999Z' } : undefined;
    const parts = await Promise.all(this.targetGames(query.game).map(game => this.matchesForGame(game, range)));
    const unique = [...new Map(parts.flat().map(match => [match.id, match])).values()].filter(match => !range || (timestamp(match) >= Date.parse(range.start) && timestamp(match) < Date.parse(range.end)));
    return unique.sort((a, b) => rank(a) - rank(b) || (a.status === 'finished' && b.status === 'finished' ? timestamp(b) - timestamp(a) : timestamp(a) - timestamp(b)));
  }
  async getLiveMatches(game?: GameId) { return (await Promise.all(this.targetGames(game).map(target => this.matchesForGame(target, undefined, 'matches/running')))).flat().filter(match => match.status === 'live'); }
  async getUpcomingMatches(game?: GameId) { return (await Promise.all(this.targetGames(game).map(target => this.matchesForGame(target, undefined, 'matches/upcoming')))).flat().filter(match => match.status === 'scheduled' || match.status === 'postponed').sort((a, b) => timestamp(a) - timestamp(b)); }
  async getPastMatches(game?: GameId) { return (await Promise.all(this.targetGames(game).map(target => this.matchesForGame(target, undefined, 'matches/past')))).flat().filter(match => match.status === 'finished').sort((a, b) => timestamp(b) - timestamp(a)); }
  private async rawMatch(matchId: string): Promise<RawMatch | null> {
    try { return await this.client.request<RawMatch>(`/matches/${encodeURIComponent(external(matchId))}`); }
    catch (error) { if (isProviderNotFound(error)) return null; throw error; }
  }
  async getMatch(matchId: string): Promise<Match | null> { const row = await this.rawMatch(matchId); return row ? this.mapMatch(row) : null; }
  async getMatchDetails(matchId: string): Promise<MatchDetails | null> {
    const row = await this.rawMatch(matchId);
    if (!row) return null;
    const match = this.mapMatch(row);
    if (!match) return null;
    if ((row.games ?? []).some(item => Number.isFinite(item.id))) console.log(`[VANT esports] op=match-maps match=${row.id} reason=map_names_not_in_free_plan permission=not_in_plan`);
    const maps = [] as MatchDetails['maps'];
    const base = { match, maps, playerStats: [] as MatchDetails['playerStats'], economy: null, veto: null, headToHead: [] as Match[], recentMatches: [] as MatchDetails['recentMatches'], capabilities: { maps: false, playerStats: false, economy: false, veto: false, headToHead: false, recentMatches: false } };
    const recent = (team: Team) => team.id.startsWith('tbd:') ? Promise.resolve({ matches: [] as Match[], hasMore: false }) : this.getTeamMatches(team.id, 'finished', 1, 5);
    const headToHead = match.homeTeam.id.startsWith('tbd:') || match.awayTeam.id.startsWith('tbd:')
      ? Promise.resolve([] as Match[])
      : this.client.request<RawMatch[]>(`/${providerSlug[match.gameId]}/matches/past`, { 'filter[opponent_id]': external(match.homeTeam.id), per_page: 20, sort: '-begin_at' })
        .then(rows => requireArray(rows).flatMap(item => { const mapped = this.mapMatch(item, match.gameId); return mapped ? [mapped] : []; }).filter(item => item.id !== match.id && [item.homeTeam.id, item.awayTeam.id].includes(match.awayTeam.id)).slice(0, 20))
        .catch(() => [] as Match[]);
    const enrichment = Promise.allSettled([recent(match.homeTeam), recent(match.awayTeam), headToHead]);
    const settled = await Promise.race([
      enrichment,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (!settled) return base;
    const [homeHistory, awayHistory, head] = settled;
    const recentMatches = [homeHistory, awayHistory].flatMap((result, index) => result.status === 'fulfilled' ? [{ teamId: index ? match.awayTeam.id : match.homeTeam.id, matches: result.value.matches.filter(item => item.id !== match.id) }] : []);
    return {
      ...base,
      headToHead: head.status === 'fulfilled' ? head.value : [],
      recentMatches,
      capabilities: { ...base.capabilities, headToHead: head.status === 'fulfilled', recentMatches: [homeHistory, awayHistory].some(result => result.status === 'fulfilled') },
    };
  }
  async getCompetitions(game?: GameId) {
    return (await Promise.all(this.targetGames(game).map(async target => (await this.client.fetchAllPages<RawLeague>(`/${providerSlug[target]}/leagues`, { sort: 'name' }, 10)).rows.map(row => mapCompetition(row, target))))).flat();
  }
  async getCompetition(competitionId: string): Promise<Competition | null> {
    try {
      const row = await this.client.request<RawLeague>(`/leagues/${encodeURIComponent(external(competitionId))}`);
      const game = gameFrom(row.videogame);
      if (game !== 'valorant') {
        console.log(`[VANT esports] op=skip-competition id=${row.id} game=${game ?? 'unknown'} reason=phase_valorant_only permission=not_requested`);
        return null;
      }
      return mapCompetition(row, game);
    } catch (error) { if (isProviderNotFound(error)) return null; throw error; }
  }
  private async entityMatches(entity: 'teams' | 'leagues', entityId: string, filter: TeamMatchFilter, page: number, perPage: number) {
    const rows = requireArray(await this.client.request<RawMatch[]>(`/${entity}/${encodeURIComponent(external(entityId))}/matches`, { page, per_page: perPage, 'filter[status]': statusFilter(filter), sort: filter === 'upcoming' ? 'begin_at' : '-begin_at' }));
    const matches = rows.flatMap(row => { const match = this.mapMatch(row); return match ? [match] : []; });
    return { matches, hasMore: rows.length === perPage };
  }
  async getCompetitionMatches(competitionId: string, filter: TeamMatchFilter, page = 1, perPage = 20) { return this.entityMatches('leagues', competitionId, filter, page, perPage); }
  async getTeams(game?: GameId) { return (await Promise.all(this.targetGames(game).map(async target => (await this.client.fetchAllPages<RawTeam>(`/${providerSlug[target]}/teams`, { sort: 'name' }, 10)).rows.map(row => mapTeam(row, target))))).flat(); }
  private async rawTeam(teamId: string): Promise<{ row: RawTeam; game: GameId } | null> {
    try {
      const key = external(teamId);
      if (/^\d+$/.test(key)) {
        const rows = requireArray(await this.client.request<RawTeam[]>('/valorant/teams', { 'filter[id]': key, per_page: 1 }));
        const row = rows.find(item => String(item.id) === key);
        return row ? { row, game: 'valorant' as const } : null;
      }
      const candidates = requireArray(await this.client.request<RawTeam[]>('/valorant/teams', { 'search[name]': key.replace(/-/g, ' '), per_page: 100 }));
      const normalize = (value: string) => value.toLowerCase().replace(/\besports\b/g, '').replace(/[^a-z0-9]/g, '');
      const exact = candidates.find(row => normalize(row.name) === normalize(key)) ?? candidates.find(row => row.acronym && normalize(row.acronym) === normalize(key));
      if (exact) return { row: exact, game: 'valorant' as const };
      const row = await this.client.request<RawTeam>(`/teams/${encodeURIComponent(key)}`);
      const game = gameFrom(row.current_videogame) ?? gameFrom(row.videogame);
      if (game && game !== 'valorant') {
        console.log(`[VANT esports] op=skip-team id=${row.id} game=${game} reason=phase_valorant_only permission=not_requested`);
        return null;
      }
      if (game === 'valorant') return { row, game };
      const rows = requireArray(await this.client.request<RawTeam[]>(`/${providerSlug.valorant}/teams`, { 'filter[id]': row.id, per_page: 1 }));
      if (rows.some(candidate => candidate.id === row.id)) return { row, game: 'valorant' as const };
      console.log(`[VANT esports] op=skip-team id=${row.id} reason=game_unconfirmed permission=not_requested`);
      return null;
    } catch (error) { if (isProviderNotFound(error)) return null; throw error; }
  }
  async getTeam(teamId: string) { const result = await this.rawTeam(teamId); return result ? mapTeam(result.row, result.game) : null; }
  async getTeamDetails(teamId: string): Promise<TeamDetails | null> {
    const result = await this.rawTeam(teamId);
    return result ? { ...mapTeam(result.row, result.game), website: result.row.website, socials: result.row.social?.url ? [{ platform: 'social', url: result.row.social.url }] : [], roster: (result.row.players ?? []).map(mapPlayer) } : null;
  }
  async getTeamMatches(teamId: string, filter: TeamMatchFilter, page = 1, perPage = 20) { return this.entityMatches('teams', teamId, filter, page, perPage); }
  async getTeamStats(teamId: string, period: '30d' = '30d'): Promise<TeamStats | null> {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const rows = (await this.client.fetchAllPages<RawMatch>(`/teams/${encodeURIComponent(external(teamId))}/matches`, { 'filter[status]': 'finished', 'range[begin_at]': `${cutoff},${new Date().toISOString()}`, sort: '-begin_at' }, 10)).rows;
    const matches = rows.flatMap(row => { const match = this.mapMatch(row); return match ? [match] : []; }).filter(match => match.startTime && timestamp(match) >= Date.parse(cutoff) && match.homeScore !== undefined && match.awayScore !== undefined);
    if (!matches.length) return null;
    const normalizedId = id(Number(external(teamId)));
    let wins = 0, losses = 0;
    for (const match of matches) {
      const own = match.homeTeam.id === normalizedId ? match.homeScore! : match.awayScore!;
      const opponent = match.homeTeam.id === normalizedId ? match.awayScore! : match.homeScore!;
      if (own > opponent) wins++; else if (own < opponent) losses++;
    }
    return { period, matches: matches.length, wins, losses };
  }
  async getTeamNews(teamId: string, limit = 5): Promise<TeamNewsArticle[]> { const team = await this.getTeam(teamId); return team ? fetchTeamNews(team.name, limit) : []; }
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const parts = await Promise.all(this.targetGames().map(async game => {
      const [teams, leagues] = await Promise.all([
        this.client.request<RawTeam[]>(`/${providerSlug[game]}/teams`, { 'search[name]': query.trim(), per_page: 20 }),
        this.client.request<RawLeague[]>(`/${providerSlug[game]}/leagues`, { 'search[name]': query.trim(), per_page: 20 }),
      ]);
      return [...requireArray(teams).map((row): SearchResult => ({ type: 'team', id: id(row.id), name: row.name, gameId: game, logoUrl: logo(row.image_url) })), ...requireArray(leagues).map((row): SearchResult => ({ type: 'competition', id: id(row.id), name: row.name, gameId: game, logoUrl: logo(row.image_url) }))];
    }));
    return [...new Map(parts.flat().map(item => [`${item.type}:${item.id}`, item])).values()];
  }
}
