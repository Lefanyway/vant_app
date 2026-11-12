// Upstash Redis over its REST API: no connection to keep open, so it works the same on a laptop or a free host.
// Without UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN every call simply goes to the origin.
const PREFIX = "vant:v1:";
const TIMEOUT_MS = 1500;

type Stats = { hits: number; misses: number; errors: number };

export class RedisCache {
  readonly stats: Stats = { hits: 0, misses: 0, errors: 0 };
  constructor(private readonly url: string, private readonly token: string) {}

  static fromEnv(): RedisCache | null {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    return url && token ? new RedisCache(url, token) : null;
  }

  private async command<T>(args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Redis request failed with status ${response.status}`);
    return ((await response.json()) as { result: T }).result;
  }

  async ping() { return (await this.command<string>(["PING"])) === "PONG"; }

  // Redis is a shared cache, never the source: when it is slow or down the origin answers.
  async remember<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.command<string | null>(["GET", PREFIX + key]);
      if (cached !== null) { this.stats.hits++; return JSON.parse(cached) as T; }
      this.stats.misses++;
    } catch {
      this.stats.errors++;
    }
    const value = await fetcher();
    // Empty answers are not shared: a provider hiccup should not stick for the whole TTL.
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
      this.command(["SET", PREFIX + key, JSON.stringify(value), "PX", Math.max(1000, Math.round(ttlMs))]).catch(() => { this.stats.errors++; });
    }
    return value;
  }
}

let shared: RedisCache | null | undefined;
export function redisCache() {
  if (shared === undefined) shared = RedisCache.fromEnv();
  return shared;
}
