export const ESPORTS_CACHE_TTL = {
  games: 24 * 60 * 60_000,
  teams: 6 * 60 * 60_000,
  competitions: 6 * 60 * 60_000,
  matchesPast: 60 * 60_000,
  matchesToday: 2 * 60_000,
  matchesFuture: 5 * 60_000,
  live: 20_000,
  matchDetail: 60_000,
  search: 5 * 60_000,
  catalogFeatured: 30 * 60_000,
  teamMatches: 60 * 60_000,
  teamRoster: 3 * 60 * 60_000,
  teamStats: 6 * 60 * 60_000,
  teamNews: 15 * 60_000,
} as const;

// An expired entry is still served while a background request refreshes it: for one more TTL on live data,
// up to 15 minutes on slower lists, so a page opened a few minutes later never waits on the provider.
type Entry = { value: unknown; expiresAt: number; staleUntil: number };

export class TtlCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<unknown>>();

  set(key: string, value: unknown, ttl: number) {
    const now = Date.now();
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + ttl, staleUntil: now + ttl + (ttl >= 60_000 ? Math.max(ttl, 15 * 60_000) : ttl) });
    if (this.entries.size > 2000) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }
  }

  // Fresh value: returned as is. Stale value: returned now and refreshed in the background.
  // Nothing usable: one upstream request, shared by every caller asking for the same key meanwhile.
  async remember<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    const now = Date.now();
    if (entry && entry.expiresAt >= now) return entry.value as T;
    if (entry && entry.staleUntil >= now) {
      this.refresh(key, ttl, fetcher).catch(() => undefined);
      return entry.value as T;
    }
    return this.refresh(key, ttl, fetcher);
  }

  private refresh<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    const running = this.pending.get(key);
    if (running) return running as Promise<T>;
    const request = fetcher()
      .then((value) => { this.set(key, value, ttl); return value; })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  get size() { return this.entries.size; }
}
