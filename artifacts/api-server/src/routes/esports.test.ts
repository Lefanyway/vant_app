import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import { createServer } from "node:http";
import router from "./esports";

type TestProvider = {
  getTeamNews?: (id: string, limit?: number) => Promise<unknown[]>;
};

const providerSelection = (provider: TestProvider | null) => {
  (globalThis as typeof globalThis & { __testProviderSelection?: unknown }).__testProviderSelection = {
    provider,
    name: provider ? "test" : null,
    configured: Boolean(provider),
  };
};

async function requestNews(teamId: string, query = "") {
  const app = express();
  app.use(router);
  const server = createServer(app).listen(0);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/teams/${teamId}/news${query}`);
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("returns sanitized unavailable news when provider has no news capability", async () => {
  providerSelection({});

  const result = await requestNews("team-without-news");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    articles: [],
    available: false,
    error: "Team news unavailable",
  });
});

test("returns normalized articles and availability when provider supplies news", async () => {
  providerSelection({
    getTeamNews: async () => [{
      id: "article-1",
      title: "Team reaches the final",
      url: "https://example.com/article-1",
      publishedAt: "2026-08-24T10:00:00.000Z",
      source: "Example News",
      summary: "A short summary",
    }],
  });

  const result = await requestNews("team-with-news", "?limit=3");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    articles: [{
      id: "article-1",
      title: "Team reaches the final",
      url: "https://example.com/article-1",
      publishedAt: "2026-08-24T10:00:00.000Z",
      source: "Example News",
      summary: "A short summary",
    }],
    available: true,
  });
});

test("uses a bounded default for missing and invalid limits", async () => {
  const limits: unknown[] = [];
  providerSelection({
    getTeamNews: async (_id, limit) => {
      limits.push(limit);
      return [];
    },
  });

  await requestNews("team-without-limit");
  await requestNews("team-with-invalid-limit", "?limit=not-a-number");

  assert.deepEqual(limits, [5, 5]);
  assert(limits.every((limit) => typeof limit === "number" && Number.isFinite(limit)));
});

test("caps a news limit above the public maximum before calling the provider", async () => {
  const limits: unknown[] = [];
  providerSelection({
    getTeamNews: async (_id, limit) => {
      limits.push(limit);
      return [];
    },
  });

  const result = await requestNews("team-with-large-limit", "?limit=999");

  assert.equal(result.status, 200);
  assert.deepEqual(limits, [20]);
  assert.deepEqual(result.body, {
    articles: [],
    available: false,
  });
});

test("sanitizes provider failures into an unavailable news response", async () => {
  providerSelection({
    getTeamNews: async () => {
      throw new Error("provider credentials or internal details");
    },
  });

  const result = await requestNews("team-with-provider-failure");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    articles: [],
    available: false,
    error: "Team news unavailable",
  });
});