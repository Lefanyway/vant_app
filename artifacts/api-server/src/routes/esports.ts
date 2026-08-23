import { Router, type Request, type Response } from "express";
import { getConfiguredProvider } from "../providers/esports";
import { ESPORTS_CACHE_TTL, TtlCache } from "../providers/esports/cache";
import type { GameId, Match } from "../providers/esports/types";

const router = Router();
const games = [{ id: "valorant", name: "VALORANT", shortName: "VALORANT" }, { id: "cs2", name: "Counter-Strike 2", shortName: "CS2" }, { id: "lol", name: "League of Legends", shortName: "LoL" }];
const cache = new TtlCache();
const providerRequired = (res: Response) => { const selected = getConfiguredProvider(); if (!selected.provider) { res.status(503).json({ error: "No esports provider configured", provider: null, configured: false }); return null; } return selected.provider; };
const game = (value: unknown) => (["valorant", "cs2", "lol"].includes(String(value)) ? String(value) as GameId : undefined);

async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) { console.log(`[VANT esports] cache=HIT key=${key}`); return hit; }
  const value = await fetcher();
  cache.set(key, value, ttl);
  return value;
}

function matchesTtl(date?: string): number {
  if (!date) return ESPORTS_CACHE_TTL.matchesToday;
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return ESPORTS_CACHE_TTL.matchesPast;
  if (date > today) return ESPORTS_CACHE_TTL.matchesFuture;
  return ESPORTS_CACHE_TTL.matchesToday;
}

const logoCache = new Map<string, { body: Buffer; contentType: string }>();
router.get("/esports/assets/logo", async (req: Request, res, next) => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
  let url: URL;
  try { url = new URL(rawUrl); if (url.protocol !== "https:" || !["images.pandascore.co", "cdn.pandascore.co", "cdn-api.pandascore.co"].includes(url.hostname)) return res.status(400).json({ error: "Unsupported logo URL" }); }
  catch { return res.status(400).json({ error: "Invalid logo URL" }); }
  const cachedLogo = logoCache.get(url.href);
  if (cachedLogo) return res.type(cachedLogo.contentType).set("Cache-Control", "public, max-age=86400").send(cachedLogo.body);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return res.status(404).end();
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return res.status(415).end();
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length) return res.status(404).end();
    logoCache.set(url.href, { body, contentType });
    return res.type(contentType).set("Cache-Control", "public, max-age=86400").send(body);
  } catch (error) { return next(error); }
});

router.get("/games", async (_req, res, next) => { const selected = getConfiguredProvider(); if (!selected.provider) return res.json(games); try { return res.json(await cached("games", ESPORTS_CACHE_TTL.games, () => selected.provider!.getGames())); } catch (error) { return next(error); } });
router.get("/matches/live", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`live:${req.query.game ?? "all"}`, ESPORTS_CACHE_TTL.live, () => selected.getLiveMatches(game(req.query.game)))); } catch (error) { return next(error); } });
router.get("/matches/upcoming", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`upcoming:${req.query.game ?? "all"}`, ESPORTS_CACHE_TTL.matchesFuture, () => selected.getUpcomingMatches(game(req.query.game)))); } catch (error) { return next(error); } });
router.get("/matches/:id/details", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { if (!selected.getMatchDetails) return res.status(404).json({ error: "Match details unavailable" }); const details = await cached(`match-details:${req.params.id}`, ESPORTS_CACHE_TTL.matchDetail, () => selected.getMatchDetails!(req.params.id)); if (!details) return res.status(404).json({ error: "Match not found" }); return res.json(details); } catch (error) { return next(error); } });
router.get("/matches/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const match = await cached<Match | null>(`match:${req.params.id}`, ESPORTS_CACHE_TTL.matchDetail, () => selected.getMatch(req.params.id)); if (!match) return res.status(404).json({ error: "Match not found" }); return res.json(match); } catch (error) { return next(error); } });
router.get("/matches", async (req, res, next) => {
  const selected = providerRequired(res); if (!selected) return;
  const query = { game: game(req.query.game), date: typeof req.query.date === "string" ? req.query.date : undefined, from: typeof req.query.from === "string" ? req.query.from : undefined, to: typeof req.query.to === "string" ? req.query.to : undefined, timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined };
  for (const value of [query.date, query.from, query.to]) if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return res.status(400).json({ error: "Invalid date format, expected YYYY-MM-DD" });
  try {
    const result = await cached(`matches:${JSON.stringify(query)}`, matchesTtl(query.date), () => selected.getMatches(query));
    console.log(`[VANT esports] op=api-matches returned=${result.length}`);
    return res.json(result);
  } catch (error) { return next(error); }
});
router.get("/competitions/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const item = await cached(`competition:${req.params.id}`, ESPORTS_CACHE_TTL.competitions, () => selected.getCompetition(req.params.id)); if (!item) return res.status(404).json({ error: "Competition not found" }); return res.json(item); } catch (error) { return next(error); } });
router.get("/competitions", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`competitions:${req.query.game ?? "all"}`, ESPORTS_CACHE_TTL.competitions, () => selected.getCompetitions(game(req.query.game)))); } catch (error) { return next(error); } });
router.get("/teams/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const item = await cached(`team:${req.params.id}`, ESPORTS_CACHE_TTL.teams, () => selected.getTeam(req.params.id)); if (!item) return res.status(404).json({ error: "Team not found" }); return res.json(item); } catch (error) { return next(error); } });
router.get("/teams", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await cached(`teams:${req.query.game ?? "all"}`, ESPORTS_CACHE_TTL.teams, () => selected.getTeams(game(req.query.game)))); } catch (error) { return next(error); } });
router.get("/search", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; const q = typeof req.query.q === "string" ? req.query.q : ""; try { return res.json(await cached(`search:${q.toLowerCase()}`, ESPORTS_CACHE_TTL.search, () => selected.search(q))); } catch (error) { return next(error); } });

router.get("/debug/provider", async (_req, res) => { if (process.env.NODE_ENV !== "development") return res.status(404).end(); const selected = getConfiguredProvider(); let reachable = false; if (selected.provider) { try { await selected.provider.getGames(); reachable = true; } catch { reachable = false; } } return res.json({ provider: selected.name, configured: selected.configured, reachable }); });
router.get("/debug/esports", async (_req, res) => { if (process.env.NODE_ENV !== "development") return res.status(404).end(); const selected = getConfiguredProvider(); let reachable = false; if (selected.provider) { try { await selected.provider.getGames(); reachable = true; } catch { reachable = false; } } return res.json({ provider: selected.name, configured: selected.configured, reachable, capabilities: selected.provider?.capabilities ?? null, cacheEntries: cache.size }); });
export default router;
