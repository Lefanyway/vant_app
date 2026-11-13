import type { Match, MatchDetails, TeamStats } from '../types';

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

  // A stored match with each team's last five results and their meetings, in one round of parallel queries.
  async matchDetails(matchId: string): Promise<MatchDetails | null> {
    const id = encodeURIComponent(matchId);
    const [row] = await this.rest<{ payload: Match; home_team_id: string | null; away_team_id: string | null }[]>(`matches?select=payload,home_team_id,away_team_id&id=eq.${id}`);
    if (!row) return null;
    const finished = (filter: string) => this.rest<{ payload: Match }[]>(`matches?select=payload&status=eq.finished&id=neq.${id}&or=${encodeURIComponent(filter)}&order=start_time.desc&limit=5`).then((rows) => rows.map((item) => item.payload));
    const team = (teamId: string) => `(home_team_id.eq."${teamId}",away_team_id.eq."${teamId}")`;
    const { home_team_id: home, away_team_id: away } = row;
    const [homeRecent, awayRecent, headToHead] = await Promise.all([
      home ? finished(team(home)) : [],
      away ? finished(team(away)) : [],
      home && away ? finished(`(and(home_team_id.eq."${home}",away_team_id.eq."${away}"),and(home_team_id.eq."${away}",away_team_id.eq."${home}"))`) : [],
    ]);
    return {
      match: row.payload, maps: [], playerStats: [], economy: null, veto: null, headToHead,
      recentMatches: [home ? { teamId: home, matches: homeRecent } : null, away ? { teamId: away, matches: awayRecent } : null].filter((group) => group !== null),
      capabilities: { maps: false, playerStats: false, economy: false, veto: false, headToHead: Boolean(home && away), recentMatches: Boolean(home || away) },
    };
  }

  // Results over the last days straight from stored matches, plus the model's current Elo for the team.
  async teamStats(teamId: string, days = 30): Promise<TeamStats | null> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const id = `"${teamId.replace(/"/g, '')}"`;
    const params = new URLSearchParams({ select: 'home_team_id,away_team_id,home_score,away_score', status: 'eq.finished', start_time: `gte.${cutoff}`, or: `(home_team_id.eq.${id},away_team_id.eq.${id})` });
    const [rows, elo] = await Promise.all([
      this.rest<{ home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null }[]>(`matches?${params.toString()}`),
      this.rest<{ elo: number }[]>(`team_elo?select=elo&team_id=eq.${encodeURIComponent(teamId)}`),
    ]);
    let wins = 0, losses = 0, matches = 0;
    for (const row of rows) {
      if (row.home_score === null || row.away_score === null || row.home_score === row.away_score) continue;
      matches++;
      const own = row.home_team_id === teamId ? row.home_score : row.away_score;
      const other = row.home_team_id === teamId ? row.away_score : row.home_score;
      if (own > other) wins++; else losses++;
    }
    const rating = elo[0]?.elo;
    if (!matches && rating === undefined) return null;
    return { period: '30d', matches, wins, losses, ...(rating !== undefined ? { elo: Math.round(rating) } : {}) };
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
