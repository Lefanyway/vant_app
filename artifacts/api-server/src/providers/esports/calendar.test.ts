import assert from "node:assert/strict";
import test from "node:test";
import { teamCalendar } from "./calendar";
import type { Match } from "./types";

const team = (id: string, name: string) => ({ id, name, externalIds: [], gameId: "valorant" as const });
const match = { id: "m1", externalIds: [], gameId: "valorant", competition: { id: "c", name: "VCT Americas", externalIds: [], gameId: "valorant" }, homeTeam: team("a", "LOUD"), awayTeam: team("b", "FURIA, BR"), startTime: "2026-11-20T18:00:00.000Z", status: "scheduled", bestOf: 3, streams: [{ url: "https://twitch.tv/valorant_br" }] } as unknown as Match;

test("builds one calendar event per upcoming match with a reminder", () => {
  const ics = teamCalendar("LOUD", [match, { ...match, id: "m2", startTime: null }], new Date("2026-11-13T00:00:00Z"));
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.match(ics, /DTSTART:20261120T180000Z\r\nDTEND:20261120T210000Z/);
  assert.match(ics, /SUMMARY:LOUD vs FURIA\\, BR/);
  assert.match(ics, /X-WR-CALNAME:LOUD · VANT/);
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.match(ics, /URL:https:\/\/twitch.tv\/valorant_br/);
});
