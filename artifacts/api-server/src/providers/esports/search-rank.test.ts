import assert from "node:assert/strict";
import test from "node:test";
import { countryName, normalize, rankResults, slugify } from "./search-rank";
import type { SearchResult } from "./types";

const team = (name: string, acronym?: string): SearchResult => ({ type: "team", id: name, name, acronym });

test("ignores accents and punctuation when comparing names", () => {
  assert.equal(normalize("KRÜ Blaze"), "kru blaze");
  assert.equal(slugify("KRÜ Blaze"), "kru-blaze");
});

test("puts exact names and acronyms first, then the shortest name", () => {
  const ranked = rankResults([team("Team Liquid Academy", "TL.A"), team("Liquid Snakes"), team("Team Liquid Brazil", "TL"), team("Team Liquid", "TL")], "liquid");
  assert.deepEqual(ranked.map((item) => item.name), ["Liquid Snakes", "Team Liquid", "Team Liquid Brazil", "Team Liquid Academy"]);
  assert.deepEqual(rankResults([team("Tidal Legends Gaming", "TLG"), team("Team Liquid", "TL")], "TL").map((item) => item.name), ["Team Liquid", "Tidal Legends Gaming"]);
});

test("matches a competition by its season name", () => {
  const vct: SearchResult = { type: "competition", id: "vct", name: "VCT", season: "Game Changers Championship 2026" };
  const other: SearchResult = { type: "competition", id: "other", name: "Changers Cup" };
  assert.deepEqual(rankResults([other, vct], "game changers").map((item) => item.id), ["vct", "other"]);
});

test("keeps one entry per team or competition, the first one found", () => {
  assert.equal(rankResults([team("KRÜ Blaze", "KRÜ"), team("KRÜ Blaze", "KRÜ")], "kru").length, 1);
  const newest: SearchResult = { type: "competition", id: "vct", name: "VCT", season: "Game Changers Championship 2026" };
  const oldest: SearchResult = { ...newest, season: "Game Changers Latin America South Closing 2024" };
  assert.equal(rankResults([newest, oldest], "game changers")[0]?.season, "Game Changers Championship 2026");
});

test("names countries in Portuguese", () => {
  assert.equal(countryName("BR"), "Brasil");
  assert.equal(countryName(""), undefined);
});

test("among equally good matches, the stronger team (higher Elo) comes first", () => {
  const ranked = rankResults([team("Cloud9 White"), team("Cloud9 GC"), team("Cloud9")], "cloud9 ", 30, new Map([["Cloud9 GC", 1700], ["Cloud9 White", 1500]]));
  assert.deepEqual(ranked.map((item) => item.name), ["Cloud9", "Cloud9 GC", "Cloud9 White"]);
});
