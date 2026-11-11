import assert from "node:assert/strict";
import test from "node:test";
import { TtlCache } from "./cache";

test("shares one upstream request between callers asking at the same time", async () => {
  const cache = new TtlCache();
  let calls = 0;
  const fetcher = async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return "value"; };
  const results = await Promise.all([cache.remember("key", 1_000, fetcher), cache.remember("key", 1_000, fetcher), cache.remember("key", 1_000, fetcher)]);
  assert.deepEqual(results, ["value", "value", "value"]);
  assert.equal(calls, 1);
});

test("serves a stale value at once and refreshes it in the background", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const cache = new TtlCache();
  await cache.remember("key", 1_000, async () => "old");

  t.mock.timers.tick(1_500);
  let refreshed!: () => void;
  const done = new Promise<void>((resolve) => { refreshed = resolve; });
  assert.equal(await cache.remember("key", 1_000, async () => { refreshed(); return "new"; }), "old");
  await done;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await cache.remember("key", 1_000, async () => "unused"), "new");
});

test("waits for a new value once the entry is too old to serve", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const cache = new TtlCache();
  await cache.remember("key", 1_000, async () => "old");
  t.mock.timers.tick(2_500);
  assert.equal(await cache.remember("key", 1_000, async () => "new"), "new");
});
