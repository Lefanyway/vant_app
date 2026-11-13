import assert from "node:assert/strict";
import test from "node:test";
import type { EsportsDataProvider, Match, MatchQuery } from "../types";
import { withSupabaseStore } from "./read";
import type { SupabaseStore } from "./store";

const stored = (id: string, status: Match["status"], startTime: string) => ({ id, status, startTime } as Match);

function provider(matches: Match[]) {
  const asked: MatchQuery[] = [];
  const value = {
    getMatches: async (query: MatchQuery) => { asked.push(query); return matches; },
    getTeamStats: async () => ({ period: "30d" as const, matches: 1, wins: 0, losses: 1 }),
  } as unknown as EsportsDataProvider;
  return { value, asked };
}

function services(options: { coverage?: { start: number; end: number } | null; rows?: Match[]; fail?: boolean }) {
  const saved: Match[][] = [];
  const store = {
    coverage: async () => options.coverage ?? null,
    matchesBetween: async () => { if (options.fail) throw new Error("db down"); return options.rows ?? []; },
    teamStats: async () => { if (options.fail) throw new Error("db down"); return { period: "30d", matches: 5, wins: 4, losses: 1, elo: 1700 }; },
  } as unknown as SupabaseStore;
  return { saved, value: { store, sync: { saveMatches: async (matches: Match[]) => { saved.push(matches); } } } };
}

test("serves a synced past day from Supabase, live first then newest result", async () => {
  const deps = services({
    coverage: { start: Date.parse("2026-01-01"), end: Date.parse("2026-12-31") },
    rows: [stored("a", "finished", "2026-10-05T12:00:00Z"), stored("b", "finished", "2026-10-05T18:00:00Z"), stored("c", "live", "2026-10-05T20:00:00Z")],
  });
  const source = provider([]);
  const matches = await withSupabaseStore(source.value, deps.value).getMatches({ date: "2026-10-05", timezone: "America/Sao_Paulo", game: "valorant" });
  assert.deepEqual(matches.map((row) => row.id), ["c", "b", "a"]);
  assert.equal(source.asked.length, 0);
});

test("asks the provider for a day outside what was synced, then saves it", async () => {
  const deps = services({ coverage: { start: Date.parse("2026-09-01"), end: Date.parse("2026-12-31") } });
  const source = provider([stored("old", "finished", "2024-03-01T12:00:00Z")]);
  const matches = await withSupabaseStore(source.value, deps.value).getMatches({ date: "2024-03-01", timezone: "UTC" });
  assert.deepEqual(matches.map((row) => row.id), ["old"]);
  assert.equal(source.asked.length, 1);
  assert.deepEqual(deps.saved[0].map((row) => row.id), ["old"]);
});

test("asks the provider for today, so live scores stay current", async () => {
  const deps = services({ coverage: { start: 0, end: Date.now() + 30 * 86_400_000 } });
  const source = provider([]);
  await withSupabaseStore(source.value, deps.value).getMatches({ date: new Date().toISOString().slice(0, 10), timezone: "UTC" });
  assert.equal(source.asked.length, 1);
});

test("leaves other games and date ranges to the provider", async () => {
  const deps = services({ coverage: { start: 0, end: Date.parse("2030-01-01") } });
  const source = provider([]);
  const reader = withSupabaseStore(source.value, deps.value);
  await reader.getMatches({ date: "2026-10-05", game: "cs2" });
  await reader.getMatches({ from: "2026-10-01", to: "2026-10-05" });
  assert.equal(source.asked.length, 2);
});

test("falls back to the provider when Supabase fails", async () => {
  const deps = services({ coverage: { start: 0, end: Date.parse("2030-01-01") }, fail: true });
  const source = provider([stored("fallback", "finished", "2026-10-05T12:00:00Z")]);
  const reader = withSupabaseStore(source.value, deps.value);
  assert.deepEqual((await reader.getMatches({ date: "2026-10-05", timezone: "UTC" })).map((row) => row.id), ["fallback"]);
  assert.deepEqual(await reader.getTeamStats!("pandascore:1"), { period: "30d", matches: 1, wins: 0, losses: 1 });
});

test("reads team stats from Supabase when it answers", async () => {
  const stats = await withSupabaseStore(provider([]).value, services({}).value).getTeamStats!("pandascore:1");
  assert.deepEqual(stats, { period: "30d", matches: 5, wins: 4, losses: 1, elo: 1700 });
});

test("returns the provider untouched when Supabase is not configured", () => {
  const source = provider([]);
  assert.equal(withSupabaseStore(source.value, { store: null, sync: null }), source.value);
});

test("opens a finished match from Supabase and a live one from the provider", async () => {
  const details = (status: Match["status"]) => ({ match: stored("m", status, "2026-10-05T12:00:00Z"), maps: [], playerStats: [], economy: null, veto: null, headToHead: [], recentMatches: [], capabilities: {} });
  let status: Match["status"] = "finished";
  const store = { matchDetails: async () => details(status) } as unknown as SupabaseStore;
  let providerCalls = 0;
  const source = { getMatches: async () => [], getMatchDetails: async () => { providerCalls++; return details("live"); } } as unknown as EsportsDataProvider;
  const reader = withSupabaseStore(source, { store, sync: null });
  assert.equal((await reader.getMatchDetails!("m"))!.match.status, "finished");
  assert.equal(providerCalls, 0);
  status = "live";
  await reader.getMatchDetails!("m");
  assert.equal(providerCalls, 1);
});
