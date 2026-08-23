import { Router, type Response } from "express";
import { getConfiguredProvider } from "../providers/esports";
import type { GameId } from "../providers/esports/types";

const router = Router();
const games = [{ id: "valorant", name: "VALORANT", shortName: "VALORANT" }, { id: "cs2", name: "Counter-Strike 2", shortName: "CS2" }, { id: "lol", name: "League of Legends", shortName: "LoL" }];
const providerRequired = (res: Response) => { const selected = getConfiguredProvider(); if (!selected.provider) { res.status(503).json({ error: "No esports provider configured", provider: null, configured: false }); return null; } return selected.provider; };
const game = (value: unknown) => (["valorant", "cs2", "lol"].includes(String(value)) ? String(value) as GameId : undefined);

router.get("/games", async (_req, res, next) => { const selected = getConfiguredProvider(); if (!selected.provider) return res.json(games); try { return res.json(await selected.provider.getGames()); } catch (error) { return next(error); } });
router.get("/matches/live", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await selected.getLiveMatches(game(req.query.game))); } catch (error) { return next(error); } });
router.get("/matches/upcoming", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await selected.getUpcomingMatches(game(req.query.game))); } catch (error) { return next(error); } });
router.get("/matches/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const match = await selected.getMatch(req.params.id); if (!match) return res.status(404).json({ error: "Match not found" }); return res.json(match); } catch (error) { return next(error); } });
router.get("/matches", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await selected.getMatches({ game: game(req.query.game), date: typeof req.query.date === "string" ? req.query.date : undefined, from: typeof req.query.from === "string" ? req.query.from : undefined, to: typeof req.query.to === "string" ? req.query.to : undefined, timezone: typeof req.query.timezone === "string" ? req.query.timezone : undefined })); } catch (error) { return next(error); } });
router.get("/competitions/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const item = await selected.getCompetition(req.params.id); if (!item) return res.status(404).json({ error: "Competition not found" }); return res.json(item); } catch (error) { return next(error); } });
router.get("/competitions", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await selected.getCompetitions(game(req.query.game))); } catch (error) { return next(error); } });
router.get("/teams/:id", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { const item = await selected.getTeam(req.params.id); if (!item) return res.status(404).json({ error: "Team not found" }); return res.json(item); } catch (error) { return next(error); } });
router.get("/teams", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await selected.getTeams(game(req.query.game))); } catch (error) { return next(error); } });
router.get("/search", async (req, res, next) => { const selected = providerRequired(res); if (!selected) return; try { return res.json(await selected.search(typeof req.query.q === "string" ? req.query.q : "")); } catch (error) { return next(error); } });
router.get("/debug/provider", async (_req, res) => { if (process.env.NODE_ENV !== "development") return res.status(404).end(); const selected = getConfiguredProvider(); let reachable = false; if (selected.provider) { try { await selected.provider.getGames(); reachable = true; } catch { reachable = false; } } return res.json({ provider: selected.name, configured: selected.configured, reachable }); });

export default router;