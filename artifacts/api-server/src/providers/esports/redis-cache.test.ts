import assert from "node:assert/strict";
import test from "node:test";
import { RedisCache } from "../../lib/redis";

// A stand-in for the Upstash REST endpoint: one command per POST, results kept in a Map.
function fakeRedis(t: test.TestContext, options: { failing?: boolean } = {}) {
  const store = new Map<string, string>();
  const commands: string[][] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const args = JSON.parse(String(init.body)) as string[];
    commands.push(args);
    if (options.failing) return new Response("down", { status: 503 });
    if (args[0] === "GET") return Response.json({ result: store.get(args[1]) ?? null });
    if (args[0] === "SET") { store.set(args[1], args[2]); return Response.json({ result: "OK" }); }
    return Response.json({ result: "PONG" });
  });
  return { store, commands };
}

test("asks the origin once, then answers from Redis", async (t) => {
  const { commands } = fakeRedis(t);
  const redis = new RedisCache("https://redis.test", "token");
  let calls = 0;
  const fetcher = async () => { calls++; return [{ id: "pandascore:1" }]; };
  assert.deepEqual(await redis.remember("matches:day", 60_000, fetcher), [{ id: "pandascore:1" }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await redis.remember("matches:day", 60_000, fetcher), [{ id: "pandascore:1" }]);
  assert.equal(calls, 1);
  assert.deepEqual(commands.find((args) => args[0] === "SET")?.slice(3), ["PX", 60_000]);
  assert.deepEqual(redis.stats, { hits: 1, misses: 1, errors: 0 });
});

test("keeps working from the origin when Redis is down", async (t) => {
  fakeRedis(t, { failing: true });
  const redis = new RedisCache("https://redis.test", "token");
  assert.equal(await redis.remember("team:1", 60_000, async () => "from origin"), "from origin");
  assert.equal(redis.stats.errors >= 1, true);
});

test("does not share an empty answer", async (t) => {
  const { store } = fakeRedis(t);
  const redis = new RedisCache("https://redis.test", "token");
  await redis.remember("live:valorant", 20_000, async () => []);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.size, 0);
});
