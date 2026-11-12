import { Router, type Request, type Response } from "express";
import { getLogo, parseLogoUrl } from "../providers/esports/logo-store";
import { getConfiguredProvider, getConfiguredStatsProvider } from "../providers/esports";
import { ESPORTS_CACHE_TTL, TtlCache } from "../providers/esports/cache";
import type { GameId, Match, TeamMatchFilter, TeamOverview } from "../providers/esports/types";
import { isCalendarDate, isTimezone } from '../providers/esports/date';
import { redisCache } from "../lib/redis";

const router = Router();
const games = [{ id: "valorant", name: "VALORANT", shortName: "VALORANT" }, { id: "cs2", name: "Counter-Strike 2", shortName: "CS2" }, { id: "lol", name: "League of Legends", shortName: "LoL" }];
const outsidePhase = (value: unknown) => { const parsed = game(value); return parsed !== undefined && parsed !== "valorant"; };
const cache = new TtlCache();
const providerRequired = (res: Response) => { const selected = getConfiguredProvider(); if (!selected.provider) { res.status(503).json({ error: "No esports provider configured", code: 'PROVIDER_NOT_CONFIGURED', retryable: false, provider: null, configured: false }); return null; } return selected.provider; };
const game = (value: unknown) => (["valorant", "cs2", "lol"].includes(String(value)) ? String(value) as GameId : undefined);
router.use((req, res, next) => {
  const invalid = (message: string) => res.status(400).json({ error: message, code: 'INVALID_QUERY', retryable: false });
  if (req.query.game !== undefined && (typeof req.query.game !== 'string' || !game(req.query.game))) return invalid('Invalid game');
  for (const key of ['date', 'from', 'to']) {
    const value = req.query[key];
    if (value !== undefined && (typeof value !== 'string' || !isCalendarDate(value))) return invalid('Invalid calendar date, expected YYYY-MM-DD');
  }
  if (req.query.timezone !== undefined && (typeof req.query.timezone !== 'string' || !isTimezone(req.query.timezone))) return invalid('Invalid timezone');
  if (typeof req.query.from === 'string' && typeof req.query.to === 'string' && req.query.from > req.query.to) return invalid('Date range is reversed');
  for (const key of ['page', 'per_page']) {
    const value = req.query[key];
    if (value !== undefined && (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)) return invalid('Invalid pagination');
  }
  if (req.query.filter !== undefined && !['all', 'upcoming', 'finished'].includes(String(req.query.filter))) return invalid('Invalid match filter');
  return next();
});

// Server memory first, then the shared Redis cache, then the origin (Supabase or PandaScore).
const cached = <T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> => {
  const redis = redisCache();
  return cache.remember(key, ttl, redis ? () => redis.remember(key, ttl, fetcher) : fetcher);
};

function matchesTtl(date?: string): number {
  if (!date) return ESPORTS_CACHE_TTL.matchesToday;
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return ESPORTS_CACHE_TTL.matchesPast;
  if (date > today) return ESPORTS_CACHE_TTL.matchesFuture;
  return ESPORTS_CACHE_TTL.matchesToday;
}

router.get("/esports/assets/logo", async (req: Request, res, next) => {
  const url = parseLogoUrl(typeof req.query.url === "string" ? req.query.url : "");
  if (!url) return res.status(400).json({ error: "Unsupported logo URL" });
  try {
    const logo = await getLogo(url);
    if ("status" in logo) return res.status(logo.status).end();
    // The source URL changes when the team uploads a new logo, so a week of client caching is safe.
    return res.type(logo.contentType).set("Cache-Control", "public, max-age=604800").send(logo.body);
  } catch (error) { return next(error); }
});

router.get('/catalog', async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  const type = req.query.type;
  if (type !== 'team' && type !== 'competition' && type !== 'all') return res.status(400).json({ error: 'Invalid catalog type' });
  if (!selected.getCatalogPage) return res.status(503).json({ error: 'Catalog unavailable' });
  const page = Number(req.query.page || 1);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  // Without a query the catalog lists who is playing around now, which changes during the day.
  const ttl = q ? ESPORTS_CACHE_TTL.teams : ESPORTS_CACHE_TTL.catalogFeatured;
  try { return res.json(await cached('catalog:' + type + ':' + page + ':' + q.toLowerCase(), ttl, () => selected.getCatalogPage!(type, page, q))); } catch (error) { return next(error); }
});
router.get("/games", async (_req, res, next) => { const selected = getConfiguredProvider(); if (!selected.provider) return res.json(games); try { return res.json(await cached("games", ESPORTS_CACHE_TTL.games, () => selected.provider!.getGames())); } catch (error) { return next(error); } });
router.get("/matches/live", async (req, res, next) => { if (outsidePhase(req.query.game)) return res.json([]); const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`live:${req.query.game ?? "valorant"}`, ESPORTS_CACHE_TTL.live, () => selected.getLiveMatches(game(req.query.game) ?? "valorant"))); } catch (error) { return next(error); } });
router.get("/matches/upcoming", async (req, res, next) => { if (outsidePhase(req.query.game)) return res.json([]); const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`upcoming:${req.query.game ?? "valorant"}`, ESPORTS_CACHE_TTL.matchesFuture, () => selected.getUpcomingMatches(game(req.query.game) ?? "valorant"))); } catch (error) { return next(error); } });
router.get("/matches/:id/details", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { if (!selected.getMatchDetails) return res.status(404).json({ error: "Match details unavailable" }); const details = await cached(`match-details:${req.params.id}`, ESPORTS_CACHE_TTL.matchDetail, () => selected.getMatchDetails!(req.params.id)); if (!details) return res.status(404).json({ error: "Match not found" }); return res.json(details); } catch (error) { return next(error); } });
router.get("/matches/:id/stats", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  const unavailable = { stats: null, capabilities: { deepStats: false, maps: false, playerStats: false, economy: false, veto: false, headToHead: false, recentMatches: false }, error: "VLR enrichment unavailable" as const };
  try {
    const statsProvider = getConfiguredStatsProvider();
    if (!statsProvider) return res.json(unavailable);
    const result = await cached(`match-stats:${req.params.id}`, ESPORTS_CACHE_TTL.matchDetail, async () => {
      try {
        const match = await selected.getMatch(req.params.id);
        if (!match || match.gameId !== "valorant" || !match.startTime) return unavailable;
        const resolved = await statsProvider.findMatch({ homeTeam: match.homeTeam, awayTeam: match.awayTeam, startTime: match.startTime, competition: match.competition, bestOf: match.bestOf });
        if (!resolved) return { ...unavailable, error: "VLR match not found" as const };
        const stats = await statsProvider.getMatchStats(resolved.providerMatchId);
        if (!stats) return unavailable;
        return { stats, capabilities: { deepStats: true, maps: stats.maps.length > 0, playerStats: stats.playerStats.length > 0, economy: Boolean(stats.economy), veto: stats.veto.length > 0, headToHead: stats.headToHead.length > 0, recentMatches: stats.recentMatches.some((group) => group.matches.length > 0) } };
      } catch { return unavailable; }
    });
    return res.json(result);
  } catch (error) { return next(error); }
});
router.get("/matches/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const match = await cached<Match | null>(`match:${req.params.id}`, ESPORTS_CACHE_TTL.matchDetail, () => selected.getMatch(req.params.id)); if (!match) return res.status(404).json({ error: "Match not found" }); return res.json(match); } catch (error) { return next(error); } });
router.get("/matches", async (req, res, next) => {
  if (outsidePhase(req.query.game)) return res.json([]);
  const selected = providerRequired(res); if (!selected) return;
  const query = { game: game(req.query.game) ?? "valorant" as const, date: typeof req.query.date === "string" ? req.query.date : undefined, from: typeof req.query.from === "string" ? req.query.from : undefined, to: typeof req.query.to === "string" ? req.query.to : undefined, timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined };
  for (const value of [query.date, query.from, query.to]) if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return res.status(400).json({ error: "Invalid date format, expected YYYY-MM-DD" });
  try {
    const result = await cached(`matches:${JSON.stringify(query)}`, matchesTtl(query.date), () => selected.getMatches(query));
    console.log(`[VANT esports] op=api-matches returned=${result.length}`);
    return res.json(result);
  } catch (error) { return next(error); }
});
router.get("/competitions/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const item = await cached(`competition:${req.params.id}`, ESPORTS_CACHE_TTL.competitions, () => selected.getCompetition(req.params.id)); if (!item) return res.status(404).json({ error: "Competition not found" }); return res.json(item); } catch (error) { return next(error); } });
router.get('/competitions/:id/matches', async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  if (!selected.getCompetitionMatches) return res.status(503).json({ error: 'Competition matches unavailable', code: 'CAPABILITY_UNAVAILABLE', retryable: false });
  const filter = String(req.query.filter ?? 'all') as TeamMatchFilter;
  const page = Number(req.query.page ?? 1);
  const perPage = Math.min(20, Number(req.query.per_page ?? 20));
  try {
    const matches = cached(`competition-matches:${req.params.id}:${filter}:${page}:${perPage}`, ESPORTS_CACHE_TTL.matchesToday, () => selected.getCompetitionMatches!(req.params.id, filter, page, perPage));
    matches.catch(() => undefined); // handled below; avoids an unhandled rejection when the competition is missing
    const competition = await cached(`competition:${req.params.id}`, ESPORTS_CACHE_TTL.competitions, () => selected.getCompetition(req.params.id));
    if (!competition) return res.status(404).json({ error: 'Competition not found', code: 'NOT_FOUND', retryable: false });
    return res.json(await matches);
  } catch (error) { return next(error); }
});
router.get("/competitions", async (req, res, next) => { if (outsidePhase(req.query.game)) return res.json([]); const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`competitions:${req.query.game ?? "valorant"}`, ESPORTS_CACHE_TTL.competitions, () => selected.getCompetitions(game(req.query.game) ?? "valorant"))); } catch (error) { return next(error); } });
router.get("/teams/:id/overview", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  try {
    // The match lists only need the id, so they load alongside the team instead of after it.
    const matchLists = Promise.allSettled([
      selected.getTeamMatches ? cached(`team-matches:${req.params.id}:overview-past`, ESPORTS_CACHE_TTL.teamMatches, () => selected.getTeamMatches!(req.params.id, 'finished', 1, 5)) : Promise.reject(new Error('Unavailable')),
      selected.getTeamMatches ? cached(`team-matches:${req.params.id}:overview-upcoming`, ESPORTS_CACHE_TTL.live, () => selected.getTeamMatches!(req.params.id, 'upcoming', 1, 5)) : Promise.reject(new Error('Unavailable')),
    ]);
    const team = await cached(`team-details:${req.params.id}`, ESPORTS_CACHE_TTL.teams, () => selected.getTeamDetails?.(req.params.id) ?? selected.getTeam(req.params.id).then((value) => value ? { ...value, roster: [] } : null));
    if (!team) return res.status(404).json({ error: "Team not found" });
    const [past, upcoming] = await matchLists;
    const recentMatches = past.status === 'fulfilled' ? past.value.matches.filter(match => match.status === 'finished').slice(0, 5) : [];
    const upcomingMatches = upcoming.status === 'fulfilled' ? upcoming.value.matches : [];
    const nextMatch = upcomingMatches.find(match => match.status === 'live') ?? upcomingMatches.find(match => ['scheduled', 'postponed'].includes(match.status)) ?? null;
    const competitions = [...new Map([...upcomingMatches, ...recentMatches].filter(match => !match.competition.id.startsWith('unknown:')).map(match => [match.competition.id, match.competition])).values()];
    const recentForm = recentMatches.flatMap((match) => {
      const home = match.homeTeam.id === team.id;
      const own = home ? match.homeScore : match.awayScore;
      const opponent = home ? match.awayScore : match.homeScore;
      if (own === undefined || opponent === undefined) return [];
      return [own > opponent ? "W" as const : own < opponent ? "L" as const : "D" as const];
    });
    const overview: TeamOverview = { team, nextMatch, recentMatches, competitions: competitions.slice(0, 5), rosterPreview: (team.roster ?? []).slice(0, 5), recentForm, capabilities: { overview: true, matches: past.status === 'fulfilled' || upcoming.status === 'fulfilled', roster: Boolean(team.roster?.length), stats: Boolean(selected.getTeamStats), news: Boolean(selected.getTeamNews) } };
    return res.json({ ...overview, warnings: [...(past.status === 'rejected' ? ['Recent matches unavailable'] : []), ...(upcoming.status === 'rejected' ? ['Upcoming matches unavailable'] : [])] });
  } catch (error) { return next(error); }
});
router.get("/teams/:id/matches", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  if (!selected.getTeamMatches) return res.status(503).json({ error: "Team matches unavailable" });
  const filter = (["all", "upcoming", "finished"].includes(String(req.query.filter)) ? String(req.query.filter) : "all") as TeamMatchFilter;
  const page = Math.max(1, Number(req.query.page) || 1); const perPage = Math.min(20, Math.max(1, Number(req.query.per_page) || 20));
  try { return res.json(await cached(`team-matches:${req.params.id}:${filter}:${page}:${perPage}`, ESPORTS_CACHE_TTL.teamMatches, () => selected.getTeamMatches!(req.params.id, filter, page, perPage))); } catch (error) { return next(error); }
});
router.get("/teams/:id/roster", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  try {
    const team = await cached(`team-details:${req.params.id}`, ESPORTS_CACHE_TTL.teams, () => selected.getTeamDetails?.(req.params.id) ?? selected.getTeam(req.params.id).then((value) => value ? { ...value, roster: [] } : null));
    if (!team) return res.status(404).json({ error: "Team not found" });
    return res.json(team.roster ?? []);
  } catch (error) { return next(error); }
});
router.get("/teams/:id/stats", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  if (!selected.getTeamStats) return res.json({ stats: null, available: false, error: "Team stats unavailable" });
  try { const stats = await cached(`team-stats:${req.params.id}:30d`, ESPORTS_CACHE_TTL.teamStats, () => selected.getTeamStats!(req.params.id, "30d")); return res.json({ stats, available: Boolean(stats) }); } catch (error) { return res.json({ stats: null, available: false, error: "Team stats unavailable" }); }
});
router.get("/teams/:id/news", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  if (!selected.getTeamNews) return res.json({ articles: [], available: false, error: "Team news unavailable" });
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  try {
    const articles = await cached(`team-news:${req.params.id}:${limit}`, ESPORTS_CACHE_TTL.teamNews, () => selected.getTeamNews!(req.params.id, limit));
    return res.json({ articles, available: articles.length > 0 });
  } catch (error) { return res.json({ articles: [], available: false, error: "Team news unavailable" }); }
});
router.get("/teams/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const item = await cached(`team:${req.params.id}`, ESPORTS_CACHE_TTL.teams, () => selected.getTeam(req.params.id)); if (!item) return res.status(404).json({ error: "Team not found" }); return res.json(item); } catch (error) { return next(error); } });
router.get("/teams", async (req, res, next) => { if (outsidePhase(req.query.game)) return res.json([]); const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`teams:${req.query.game ?? "valorant"}`, ESPORTS_CACHE_TTL.teams, () => selected.getTeams(game(req.query.game) ?? "valorant"))); } catch (error) { return next(error); } });
router.get("/search", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; const q = typeof req.query.q === "string" ? req.query.q : ""; try { return res.json(await cached(`search:${q.toLowerCase()}`, ESPORTS_CACHE_TTL.search, () => selected.search(q))); } catch (error) { return next(error); } });

router.get("/debug/provider", async (_req, res) => { if (process.env.NODE_ENV !== "development") return res.status(404).end(); const selected = getConfiguredProvider(); let reachable = false; if (selected.provider?.health) { try { await selected.provider.health(); reachable = true; } catch { reachable = false; } } return res.json({ provider: selected.name, configured: selected.configured, reachable }); });
router.get("/debug/esports", async (_req, res) => { if (process.env.NODE_ENV !== "development") return res.status(404).end(); const selected = getConfiguredProvider(); let reachable = false; if (selected.provider?.health) { try { await selected.provider.health(); reachable = true; } catch { reachable = false; } } return res.json({ provider: selected.name, configured: selected.configured, reachable, capabilities: selected.provider?.capabilities ?? null, cacheEntries: cache.size }); });
router.get("/debug/providers", async (_req, res) => {
  if (process.env.NODE_ENV !== "development") return res.status(404).end();
  const fixtures = getConfiguredProvider();
  const stats = getConfiguredStatsProvider();
  let pandaReachable = false; let vlrReachable = false;
  if (fixtures.provider?.health) { try { await fixtures.provider.health(); pandaReachable = true; } catch { /* sanitized health result */ } }
  if (stats) { try { await stats.health(); vlrReachable = true; } catch { /* sanitized health result */ } }
  return res.json({ pandascore: { configured: fixtures.configured, reachable: pandaReachable }, vlr: { configured: Boolean(stats), reachable: vlrReachable } });
});
export default router;
