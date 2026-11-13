import { logger } from '../../../lib/logger';
import { localDayBounds } from '../date';
import type { EsportsDataProvider, Match, MatchQuery } from '../types';
import { SupabaseStore } from './store';
import { SupabaseSync } from './sync';

const HOUR = 3_600_000;
const timestamp = (match: Match) => match.startTime ? Date.parse(match.startTime) : Number.POSITIVE_INFINITY;
const rank = (match: Match) => match.status === 'live' ? 0 : match.status === 'scheduled' ? 1 : 2;
const ordered = (matches: Match[]) => matches.sort((a, b) => rank(a) - rank(b) || (a.status === 'finished' && b.status === 'finished' ? timestamp(b) - timestamp(a) : timestamp(a) - timestamp(b)));

let shared: { store: SupabaseStore | null; sync: SupabaseSync | null } | null = null;
export function supabaseServices() {
  if (!shared) {
    const store = SupabaseStore.fromEnv();
    shared = { store, sync: SupabaseSync.fromEnv(store) };
  }
  return shared;
}

// Days already synced are read from Supabase; days around now still come from the provider, then are saved.
export function withSupabaseStore(provider: EsportsDataProvider, services: { store: SupabaseStore | null; sync: Pick<SupabaseSync, 'saveMatches'> | null } = supabaseServices()): EsportsDataProvider {
  const { store, sync } = services;
  if (!store) return provider;
  const fromProvider = provider.getMatches.bind(provider);
  const getMatches = async (query: MatchQuery = {}): Promise<Match[]> => {
    if (!query.date || (query.game && query.game !== 'valorant')) return fromProvider(query);
    const range = localDayBounds(query.date, query.timezone);
    const start = Date.parse(range.start), end = Date.parse(range.end), now = Date.now();
    const nearNow = end > now - 6 * HOUR && start < now + 6 * HOUR;
    const coverage = nearNow ? null : await store.coverage().catch(() => null);
    if (coverage && start >= coverage.start && end <= coverage.end) {
      try { return ordered(await store.matchesBetween(range.start, range.end)); }
      catch (error) { logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'Supabase read failed; using provider'); }
    }
    const matches = await fromProvider(query);
    sync?.saveMatches(matches).catch(() => undefined);
    return matches;
  };
  // Team results come from stored matches; the provider answers only if Supabase cannot.
  const fromProviderStats = provider.getTeamStats?.bind(provider);
  const getTeamStats = async (teamId: string, period: '30d' = '30d') => {
    try { return await store.teamStats(teamId, 30); }
    catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'Supabase team stats failed; using provider');
      return fromProviderStats ? fromProviderStats(teamId, period) : null;
    }
  };
  // A match page reads the stored match and both teams' history from Supabase; a live match asks the provider only for the current score.
  const fromProviderDetails = provider.getMatchDetails?.bind(provider);
  const getMatchDetails = async (matchId: string) => {
    const details = await store.matchDetails(matchId).catch(() => null);
    if (details && details.match.status !== 'live') return details;
    if (details) return { ...details, match: (await provider.getMatch(matchId).catch(() => null)) ?? details.match };
    return fromProviderDetails ? fromProviderDetails(matchId) : details;
  };
  const getMatch = async (matchId: string) => {
    const details = await store.matchDetails(matchId).catch(() => null);
    return details && details.match.status !== 'live' ? details.match : provider.getMatch(matchId);
  };
  return Object.assign(Object.create(provider) as EsportsDataProvider, { getMatches, getTeamStats, getMatchDetails, getMatch });
}
