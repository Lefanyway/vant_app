import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseStore } from "./store";

type Route = (url: URL, init: RequestInit) => unknown;

// Answers Supabase REST calls by table, and records what was asked.
function fakeSupabase(t: test.TestContext, routes: Record<string, Route>) {
  const calls: { url: URL; init: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    const table = url.pathname.replace("/rest/v1/", "");
    const route = routes[table];
    if (!route) return new Response("not found", { status: 404 });
    return Response.json(route(url, init));
  });
  return calls;
}

const TEAM = "pandascore:42";

test("counts wins and losses for the team, skipping draws and missing scores, and adds its Elo", async (t) => {
  const calls = fakeSupabase(t, {
    matches: () => [
      { home_team_id: TEAM, away_team_id: "pandascore:1", home_score: 2, away_score: 0 },
      { home_team_id: "pandascore:2", away_team_id: TEAM, home_score: 2, away_score: 1 },
      { home_team_id: TEAM, away_team_id: "pandascore:3", home_score: 1, away_score: 1 },
      { home_team_id: "pandascore:4", away_team_id: TEAM, home_score: null, away_score: null },
      { home_team_id: "pandascore:5", away_team_id: TEAM, home_score: 0, away_score: 2 },
    ],
    team_elo: () => [{ elo: 1612.6 }],
  });
  const stats = await new SupabaseStore("https://db.test", "publishable").teamStats(TEAM, 30);
  assert.deepEqual(stats, { period: "30d", matches: 3, wins: 2, losses: 1, elo: 1613 });
  const matchesQuery = calls.find((call) => call.url.pathname.endsWith("/matches"))!.url;
  assert.equal(matchesQuery.searchParams.get("status"), "eq.finished");
  assert.match(matchesQuery.searchParams.get("or")!, /home_team_id\.eq\."pandascore:42"/);
});

test("has no stats for a team with no results and no rating", async (t) => {
  fakeSupabase(t, { matches: () => [], team_elo: () => [] });
  assert.equal(await new SupabaseStore("https://db.test", "publishable").teamStats(TEAM), null);
});

test("reads a day's matches in time order from the stored payloads", async (t) => {
  const calls = fakeSupabase(t, { matches: () => [{ payload: { id: "pandascore:1" } }, { payload: { id: "pandascore:2" } }] });
  const rows = await new SupabaseStore("https://db.test", "publishable").matchesBetween("2026-10-01T03:00:00.000Z", "2026-10-02T03:00:00.000Z");
  assert.deepEqual(rows.map((row) => row.id), ["pandascore:1", "pandascore:2"]);
  const query = calls[0].url.searchParams;
  assert.deepEqual(query.getAll("start_time"), ["gte.2026-10-01T03:00:00.000Z", "lt.2026-10-02T03:00:00.000Z"]);
  assert.equal(query.get("order"), "start_time.asc");
});

test("refuses to write without the ingest key", async () => {
  const store = new SupabaseStore("https://db.test", "publishable");
  assert.equal(store.canWrite, false);
  await assert.rejects(store.ingest({ competitions: [], teams: [], players: [], matches: [], kind: "test" }), /SUPABASE_INGEST_KEY/);
});

test("sends the ingest key only in the request body, through the RPC", async (t) => {
  const calls = fakeSupabase(t, { "rpc/ingest_esports": () => ({ matches: 0, teams: 0, players: 0 }) });
  await new SupabaseStore("https://db.test", "publishable", "secret-ingest-key").ingest({ competitions: [], teams: [], players: [], matches: [], kind: "window" });
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url.search, "");
  assert.equal(JSON.parse(String(calls[0].init.body)).p_key, "secret-ingest-key");
});

test("reports an HTTP failure without echoing the response body", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("leaked detail", { status: 500 }));
  await assert.rejects(new SupabaseStore("https://db.test", "publishable").matchesBetween("a", "b"), (error: Error) => !error.message.includes("leaked") && /500/.test(error.message));
});
