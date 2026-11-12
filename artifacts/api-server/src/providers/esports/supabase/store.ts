import type { Match } from '../types';

export type IngestCompetition = { id: string; name: string; slug?: string; logo_url?: string; region?: string; game_id: string };
export type IngestTeam = { id: string; name: string; acronym?: string; logo_url?: string; country?: string; game_id: string };
export type IngestPlayer = { id: string; team_id: string; name: string; full_name?: string; image_url?: string; country?: string; role?: string; status?: string };
export type IngestMatch = {
  id: string; game_id: string; competition_id: string | null; serie_name?: string; home_team_id: string | null; away_team_id: string | null;
  status: Match['status']; start_time: string | null; scheduled_time: string | null; best_of?: number; home_score?: number; away_score?: number;
  streams: Match['streams']; payload: Match;
};
export type IngestBatch = { competitions: IngestCompetition[]; teams: IngestTeam[]; players: IngestPlayer[]; matches: IngestMatch[]; kind: string; rangeStart?: string; rangeEnd?: string };
export type Coverage = { start: number; end: number };

// Talks to Supabase over its REST API: public reads with the publishable key, writes only through ingest_esports.
export class SupabaseStore {
  private coverageCache: { value: Coverage | null; expires: number } | null = null;
  constructor(private readonly url: string, private readonly key: string, private readonly ingestKey?: string) {}

  static fromEnv(): SupabaseStore | null {
    const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
    const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) return null;
    return new SupabaseStore(url, key, process.env.SUPABASE_INGEST_KEY?.trim() || undefined);
  }

  get canWrite() { return Boolean(this.ingestKey); }

  private async rest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
    });
    // Never echo the response body: it could quote request values.
    if (!response.ok) throw new Error(`Supabase request failed with status ${response.status}`);
    return await response.json() as T;
  }

  async ingest(batch: IngestBatch) {
    if (!this.ingestKey) throw new Error('SUPABASE_INGEST_KEY is not configured');
    const result = await this.rest<{ matches: number; teams: number; players: number }>('rpc/ingest_esports', {
      method: 'POST',
      body: JSON.stringify({
        p_key: this.ingestKey, p_competitions: batch.competitions, p_teams: batch.teams, p_players: batch.players, p_matches: batch.matches,
        p_kind: batch.kind, p_range_start: batch.rangeStart ?? null, p_range_end: batch.rangeEnd ?? null,
      }),
    });
    if (batch.kind !== 'live') this.coverageCache = null;
    return result;
  }

  async matchesBetween(start: string, end: string): Promise<Match[]> {
    const params = new URLSearchParams({ select: 'payload', order: 'start_time.asc', limit: '1000' });
    params.append('start_time', `gte.${start}`);
    params.append('start_time', `lt.${end}`);
    const rows = await this.rest<{ payload: Match }[]>(`matches?${params.toString()}`);
    return rows.map(row => row.payload);
  }

  // The span of time a backfill or window sync has already written, so an empty day there is truly empty.
  async coverage(): Promise<Coverage | null> {
    if (this.coverageCache && this.coverageCache.expires > Date.now()) return this.coverageCache.value;
    const query = (order: 'range_start.asc' | 'range_end.desc') => this.rest<{ range_start: string; range_end: string }[]>(
      `sync_runs?select=range_start,range_end&kind=in.(backfill,window)&range_start=not.is.null&order=${order}&limit=1`);
    const [[first], [last]] = await Promise.all([query('range_start.asc'), query('range_end.desc')]);
    const value = first && last ? { start: Date.parse(first.range_start), end: Date.parse(last.range_end) } : null;
    this.coverageCache = { value, expires: Date.now() + 5 * 60_000 };
    return value;
  }
}
