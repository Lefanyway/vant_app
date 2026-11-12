import { logger } from '../../../lib/logger';
import { PandaScoreAdapter, mapPlayer, type RawMatch, type RawTeam } from '../pandascore/adapter';
import { PandaScoreClient } from '../pandascore/client';
import type { Match } from '../types';
import { SupabaseStore, type IngestBatch, type IngestPlayer } from './store';

const DAY = 86_400_000;
// All of PandaScore's Valorant history (it starts in 2021): about 18 thousand matches, near 70 MB of the free 500 MB.
const BACKFILL_FROM = Date.parse(process.env.VANT_BACKFILL_FROM || '2021-01-01T00:00:00Z');
const AHEAD_DAYS = 14;
const WINDOW_DAYS = 7;
const BACKFILL_WEEKS_PER_TICK = 24;
const TICK_MS = 10 * 60_000;

// Tables keep PandaScore's own image URL; payload keeps the URL as the API serves it, through its logo proxy.
const sourceUrl = (url?: string) => {
  if (!url) return undefined;
  try { return new URL(url, 'http://local').searchParams.get('url') ?? url; } catch { return url; }
};
const known = (id?: string) => id && !id.startsWith('tbd:') && !id.startsWith('unknown:') ? id : null;

export class SupabaseSync {
  private readonly rostersSynced = new Set<string>();
  private running: Promise<void> | null = null;
  constructor(private readonly client: PandaScoreClient, private readonly adapter: PandaScoreAdapter, private readonly store: SupabaseStore) {}

  static fromEnv(store: SupabaseStore | null) {
    const token = process.env.PANDASCORE_API_TOKEN;
    if (!token || !store?.canWrite) return null;
    const client = new PandaScoreClient(token, undefined, { timeoutMs: 15_000 });
    return new SupabaseSync(client, new PandaScoreAdapter(client), store);
  }

  // Writes matches the API already fetched for a request, so the store stays fresh between ticks.
  async saveMatches(matches: Match[], kind = 'live') {
    if (matches.length) await this.store.ingest(this.batch(matches, [], kind));
  }

  start() {
    const tick = () => { if (!this.running) this.running = this.runOnce().catch(error => logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'Supabase sync failed')).finally(() => { this.running = null; }); };
    tick();
    setInterval(tick, TICK_MS).unref();
  }

  async runOnce() {
    const now = Date.now();
    // Recent days and the coming two weeks change often: scores, reschedules, new matches.
    await this.syncRange(now - 2 * DAY, now + AHEAD_DAYS * DAY, 'window');
    const live = await this.client.request<RawMatch[]>('/valorant/matches/running', { per_page: 100 });
    await this.ingestRows(Array.isArray(live) ? live : [], 'live');
    // The first run fills the history back to BACKFILL_FROM; later runs only fill what is missing.
    const coverage = await this.store.coverage();
    // A few weeks per tick keep the free PandaScore quota (1000 requests an hour) free for the app itself.
    if (!coverage || coverage.start > BACKFILL_FROM + DAY) await this.syncRange(BACKFILL_FROM, Math.min(coverage?.start ?? now, now - 2 * DAY), 'backfill', BACKFILL_WEEKS_PER_TICK);
  }

  // Newest week first, so a run that stops halfway still leaves one unbroken span behind it.
  private async syncRange(from: number, to: number, kind: string, maxWindows = Infinity) {
    let total = 0;
    for (let end = to, windows = 0; end > from && windows < maxWindows; end -= WINDOW_DAYS * DAY, windows++) {
      const start = Math.max(end - WINDOW_DAYS * DAY, from);
      const range = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
      const { rows } = await this.client.fetchAllPages<RawMatch>('/valorant/matches', { sort: 'begin_at', 'range[begin_at]': `${range.start},${range.end}` }, 30);
      total += await this.ingestRows(rows, kind, range);
    }
    logger.info({ kind, from: new Date(from).toISOString(), to: new Date(to).toISOString(), matches: total }, 'Supabase sync range done');
  }

  private async ingestRows(rows: RawMatch[], kind: string, range?: { start: string; end: string }) {
    const matches = rows.flatMap(row => { try { const match = this.adapter.mapMatch(row, 'valorant'); return match ? [match] : []; } catch { return []; } });
    const players = await this.rosters(matches);
    const batch = this.batch(matches, players, kind, range);
    // PostgREST bodies stay small enough in chunks of 200 matches; the run is recorded once per range.
    for (let index = 0; index < Math.max(1, batch.matches.length); index += 200) {
      const last = index + 200 >= batch.matches.length;
      await this.store.ingest({ ...batch, matches: batch.matches.slice(index, index + 200), players: index === 0 ? batch.players : [], kind: last ? kind : `${kind}-part`, rangeStart: last ? range?.start : undefined, rangeEnd: last ? range?.end : undefined });
    }
    return matches.length;
  }

  // Current rosters, fetched once per team per process, 100 teams a request.
  private async rosters(matches: Match[]): Promise<IngestPlayer[]> {
    const ids = [...new Set(matches.flatMap(match => [known(match.homeTeam.id), known(match.awayTeam.id)]).filter((id): id is string => Boolean(id)))].filter(id => !this.rostersSynced.has(id));
    const players: IngestPlayer[] = [];
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100);
      const teams = await this.client.request<RawTeam[]>('/valorant/teams', { 'filter[id]': chunk.map(id => id.replace('pandascore:', '')).join(','), per_page: 100 }).catch(() => [] as RawTeam[]);
      for (const team of Array.isArray(teams) ? teams : []) {
        for (const raw of team.players ?? []) {
          const player = mapPlayer(raw);
          players.push({ id: player.id, team_id: `pandascore:${team.id}`, name: player.name, full_name: player.fullName, image_url: sourceUrl(player.imageUrl), country: player.country, role: player.role, status: player.status });
        }
      }
      chunk.forEach(id => this.rostersSynced.add(id));
    }
    return players;
  }

  private batch(matches: Match[], players: IngestPlayer[], kind: string, range?: { start: string; end: string }): IngestBatch {
    const teams = new Map<string, IngestBatch['teams'][number]>();
    const competitions = new Map<string, IngestBatch['competitions'][number]>();
    for (const match of matches) {
      for (const team of [match.homeTeam, match.awayTeam]) {
        if (known(team.id)) teams.set(team.id, { id: team.id, name: team.name, acronym: team.acronym, logo_url: sourceUrl(team.logoUrl), country: team.country, game_id: team.gameId });
      }
      if (known(match.competition.id)) competitions.set(match.competition.id, { id: match.competition.id, name: match.competition.name, slug: match.competition.slug, logo_url: sourceUrl(match.competition.logoUrl), region: match.competition.region, game_id: match.gameId });
    }
    return {
      kind, rangeStart: range?.start, rangeEnd: range?.end,
      competitions: [...competitions.values()],
      teams: [...teams.values()],
      // A player row needs its team row in the same write.
      players: players.filter(player => teams.has(player.team_id)),
      matches: matches.map(match => ({
        id: match.id, game_id: match.gameId, competition_id: known(match.competition.id), serie_name: match.competition.serieName,
        home_team_id: known(match.homeTeam.id), away_team_id: known(match.awayTeam.id), status: match.status,
        start_time: match.startTime, scheduled_time: match.scheduledTime ?? null, best_of: match.bestOf, home_score: match.homeScore, away_score: match.awayScore,
        streams: match.streams ?? [], payload: match,
      })),
    };
  }
}
