import assert from "node:assert/strict";
import test from "node:test";
import { PandaScoreAdapter } from "../pandascore/adapter";
import type { PandaScoreClient } from "../pandascore/client";
import type { Match } from "../types";
import type { Coverage, IngestBatch, SupabaseStore } from "./store";
import { SupabaseSync } from "./sync";

const DAY = 86_400_000;

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "pandascore:900", externalIds: [], gameId: "valorant", status: "finished", startTime: "2026-10-01T18:00:00.000Z", bestOf: 3, homeScore: 2, awayScore: 1,
    competition: { id: "pandascore:7", externalIds: [], name: "VCT Americas", serieName: "Stage 2", logoUrl: "/api/esports/assets/logo?url=https%3A%2F%2Fcdn.pandascore.co%2Fleague.png", gameId: "valorant" },
    homeTeam: { id: "pandascore:1", externalIds: [], name: "LOUD", acronym: "LOUD", logoUrl: "/api/esports/assets/logo?url=https%3A%2F%2Fcdn.pandascore.co%2Floud.png", country: "BR", gameId: "valorant" },
    awayTeam: { id: "tbd:900:away", externalIds: [], name: "TBD", gameId: "valorant" },
    ...overrides,
  };
}

function fakeStore(coverage: Coverage | null = null) {
  const batches: IngestBatch[] = [];
  const store = { canWrite: true, ingest: async (batch: IngestBatch) => { batches.push(batch); return { matches: batch.matches.length, teams: 0, players: 0 }; }, coverage: async () => coverage } as unknown as SupabaseStore;
  return { store, batches };
}

function fakeClient() {
  const ranges: string[] = [];
  const client = {
    request: async () => [],
    fetchAllPages: async (_endpoint: string, params: Record<string, string>) => { ranges.push(params["range[begin_at]"]); return { rows: [], pages: 1 }; },
  } as unknown as PandaScoreClient;
  return { client, ranges };
}

test("stores a match with its original logo URLs and empty links for unknown teams", async () => {
  const { store, batches } = fakeStore();
  const { client } = fakeClient();
  await new SupabaseSync(client, new PandaScoreAdapter(client), store).saveMatches([match()]);
  const [batch] = batches;
  assert.equal(batch.kind, "live");
  assert.deepEqual(batch.teams.map((team) => team.id), ["pandascore:1"]);
  assert.equal(batch.teams[0].logo_url, "https://cdn.pandascore.co/loud.png");
  assert.equal(batch.competitions[0].logo_url, "https://cdn.pandascore.co/league.png");
  assert.equal(batch.matches[0].away_team_id, null);
  assert.equal(batch.matches[0].payload.awayTeam.name, "TBD");
});

test("leaves the competition empty when the provider gave no league", async () => {
  const { store, batches } = fakeStore();
  const { client } = fakeClient();
  const unknown = match({ competition: { id: "unknown:900", externalIds: [], name: "Qualifier", gameId: "valorant" } });
  await new SupabaseSync(client, new PandaScoreAdapter(client), store).saveMatches([unknown]);
  assert.equal(batches[0].competitions.length, 0);
  assert.equal(batches[0].matches[0].competition_id, null);
});

test("writes nothing for an empty list", async () => {
  const { store, batches } = fakeStore();
  const { client } = fakeClient();
  await new SupabaseSync(client, new PandaScoreAdapter(client), store).saveMatches([]);
  assert.equal(batches.length, 0);
});

test("fills history newest week first and stops after the per-tick limit", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-12T12:00:00Z") });
  const now = Date.now();
  // Already covered: the last 30 days. Missing: everything back to 2021.
  const { store, batches } = fakeStore({ start: now - 30 * DAY, end: now + 14 * DAY });
  const { client, ranges } = fakeClient();
  await new SupabaseSync(client, new PandaScoreAdapter(client), store).runOnce();
  const backfill = batches.filter((batch) => batch.kind === "backfill");
  assert.equal(backfill.length, 24);
  const ends = backfill.map((batch) => Date.parse(batch.rangeEnd!));
  assert.deepEqual(ends, [...ends].sort((a, b) => b - a), "newest first");
  assert.equal(ends[0], now - 30 * DAY, "continues right where coverage starts");
  for (let index = 1; index < backfill.length; index++) assert.equal(backfill[index].rangeEnd, backfill[index - 1].rangeStart, "no gaps between weeks");
  assert.ok(ranges.length >= 24 + 3);
});

test("skips the backfill once history reaches the start date", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-12T12:00:00Z") });
  const { store, batches } = fakeStore({ start: Date.parse("2021-01-01T00:00:00Z"), end: Date.now() + 14 * DAY });
  const { client } = fakeClient();
  await new SupabaseSync(client, new PandaScoreAdapter(client), store).runOnce();
  assert.equal(batches.some((batch) => batch.kind === "backfill"), false);
  assert.ok(batches.some((batch) => batch.kind === "window"));
});
