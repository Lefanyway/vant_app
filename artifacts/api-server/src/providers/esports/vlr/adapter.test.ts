import assert from "node:assert/strict";
import test from "node:test";
import { VlrValorantStatsProvider } from "./adapter.ts";
import type { Team } from "../types.ts";

const team = (id: string, name: string): Team => ({
  id,
  externalIds: [],
  name,
  gameId: "valorant",
});

const input = {
  homeTeam: team("home", "Sentinels"),
  awayTeam: team("away", "KRU Esports"),
  startTime: "2026-08-24T18:00:00.000Z",
};

const providerWith = (responses: unknown[]) => {
  let index = 0;
  const client = {
    request: async () => responses[index++],
    health: async () => undefined,
  };
  return new VlrValorantStatsProvider(client as never);
};

test("returns null when VLR has no matching match", async () => {
  const provider = providerWith([[{ id: "vlr-1", home_team: "FNATIC", away_team: "G2", start_time: input.startTime }]]);
  assert.equal(await provider.findMatch(input), null);
});

test("keeps a partial stats payload usable and hides the provider ID", async () => {
  const provider = providerWith([{ maps: [{ id: "map-1", mapName: "Ascent", mapNumber: 1 }], players: [{ playerId: "p1", playerName: "Player" }], economy: null }]);
  const stats = await provider.getMatchStats("vlr-secret-id");
  assert.deepEqual(stats, {
    maps: [{ id: "map-1", mapName: "Ascent", mapNumber: 1 }],
    playerStats: [{ playerId: "p1", playerName: "Player" }],
    economy: undefined,
    veto: [],
    headToHead: [],
    recentMatches: [],
  });
  assert.equal("providerMatchId" in (stats ?? {}), false);
});

test("treats an invalid stats payload as unavailable", async () => {
  const provider = providerWith([null]);
  assert.equal(await provider.getMatchStats("vlr-id"), null);
});

test("propagates VLR HTTP and timeout errors for the route boundary to contain", async () => {
  for (const error of [new Error("VLR stats request failed: 503"), new DOMException("timed out", "TimeoutError")]) {
    const provider = new VlrValorantStatsProvider({
      request: async () => { throw error; },
      health: async () => { throw error; },
    } as never);
    await assert.rejects(() => provider.findMatch(input), error);
  }
});