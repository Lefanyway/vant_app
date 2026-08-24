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
  teamMatches: 60 * 60_000,
  teamRoster: 3 * 60 * 60_000,
  teamStats: 6 * 60 * 60_000,
  teamNews: 15 * 60_000,
} as const;

type Entry = { value: unknown; expiresAt: number };

export class TtlCache {
  private readonly entries = new Map<string, Entry>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) { this.entries.delete(key); return undefined; }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttl: number) {
    this.entries.set(key, { value, expiresAt: Date.now() + ttl });
    if (this.entries.size > 500) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }
  }

  get size() { return this.entries.size; }
}
