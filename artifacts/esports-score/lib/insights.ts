import { supabase } from "@/lib/supabase";

export type Score = { accuracy: number; brier: number };
export type InsightTeam = { id: string; name: string; acronym?: string; logoUrl?: string };
export type Features = Record<string, number>;
export type Coefficients = Record<string, number>;
export type Upcoming = { id: string; start_time: string; payload: { homeTeam: InsightTeam; awayTeam: InsightTeam; competition: { id?: string; name: string; logoUrl?: string } }; predictions: { home_win_prob: number; features: Features | null } | null };
export type Finished = Upcoming & { home_score: number | null; away_score: number | null };
export type Ranked = { team_id: string; elo: number; name: string; logo_url?: string };

const DAY = 86_400_000;

// Everything here comes straight from Supabase: the latest training run, the model's picks, how it did lately and its Elo table.
export async function fetchInsights() {
  const [run, upcoming, finished, elo] = await Promise.all([
    supabase.from("model_runs").select("train_matches, test_matches, metrics, coefficients, trained_at").order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("matches").select("id, start_time, payload, predictions(home_win_prob, features)").eq("status", "scheduled").gte("start_time", new Date().toISOString()).order("start_time").limit(10),
    // Every prediction of a finished match was made before it started, so this is an honest scorecard.
    supabase.from("matches").select("id, start_time, payload, home_score, away_score, predictions!inner(home_win_prob, features)").eq("status", "finished").gte("start_time", new Date(Date.now() - 2 * DAY).toISOString()).order("start_time", { ascending: false }).limit(40),
    // Only teams that played in the last six months, so retired rosters do not top the table.
    supabase.from("team_elo").select("team_id, elo").gte("rated_at", new Date(Date.now() - 180 * DAY).toISOString()).order("elo", { ascending: false }).limit(10),
  ]);
  const error = run.error ?? upcoming.error ?? finished.error ?? elo.error;
  if (error) throw error;
  const ids = (elo.data ?? []).map((row) => row.team_id);
  const teams = ids.length ? await supabase.from("teams").select("id, name, logo_url").in("id", ids) : { data: [] };
  const ranking: Ranked[] = (elo.data ?? []).map((row) => { const team = teams.data?.find((item) => item.id === row.team_id); return { team_id: row.team_id, elo: row.elo, name: team?.name ?? "Equipe", logo_url: team?.logo_url ?? undefined }; });
  const results = ((finished.data ?? []) as unknown as Finished[]).filter((match) => match.home_score !== null && match.away_score !== null && match.home_score !== match.away_score && match.predictions);
  return {
    run: run.data as { train_matches: number; test_matches: number; metrics: { model: Score; elo_only: Score; coin_flip: Score }; coefficients: Coefficients } | null,
    upcoming: (upcoming.data ?? []) as unknown as Upcoming[],
    results,
    ranking,
  };
}

// Did the team the model favoured win?
export const modelHit = (match: Finished) => (match.predictions!.home_win_prob >= 0.5) === (match.home_score! > match.away_score!);

export function confidence(chance: number) {
  // Uses the rounded percentage the screen shows, so "70%" never reads as "Leve favorito".
  const top = Math.round(Math.max(chance, 1 - chance) * 100);
  return top >= 70 ? "Favorito claro" : top >= 55 ? "Leve favorito" : "Jogo equilibrado";
}

// The model's reasons: each factor's weight times its value, in log-odds toward the first team.
// Elo and its best-of version are one idea for the user, and "listed first" is only PandaScore's ordering.
const factors = [
  { label: "Força (Elo)", keys: ["elo_diff", "elo_diff_bo"] },
  { label: "Forma recente", keys: ["form_diff"] },
  { label: "Experiência", keys: ["experience_diff"] },
  { label: "Confrontos diretos", keys: ["h2h_diff"] },
  { label: "Descanso", keys: ["rest_diff"] },
];
export function explain(features: Features, coefficients: Coefficients) {
  return factors.map(({ label, keys }) => ({ label, weight: keys.reduce((sum, key) => sum + (coefficients[key] ?? 0) * (features[key] ?? 0), 0) }))
    .filter((factor) => Math.abs(factor.weight) >= 0.01)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

export const probability = (features: Features, coefficients: Coefficients) => 1 / (1 + Math.exp(-Object.keys(coefficients).reduce((sum, key) => sum + coefficients[key] * (features[key] ?? 0), 0)));

type Played = { home_team_id: string; away_team_id: string; home_score: number; away_score: number; start_time: string };

// Rebuilds the model's inputs for any two teams from stored results, the same way ml/train.py does before a match.
export async function simulate(a: string, b: string, coefficients: Coefficients, bestOf = 3) {
  const history = (team: string) => supabase.from("matches").select("home_team_id, away_team_id, home_score, away_score, start_time", { count: "exact" }).eq("status", "finished").not("home_score", "is", null).or(`home_team_id.eq."${team}",away_team_id.eq."${team}"`).order("start_time", { ascending: false }).limit(5);
  const [eloRows, historyA, historyB, meetings] = await Promise.all([
    supabase.from("team_elo").select("team_id, elo").in("team_id", [a, b]),
    history(a),
    history(b),
    supabase.from("matches").select("home_team_id, away_team_id, home_score, away_score, start_time").eq("status", "finished").or(`and(home_team_id.eq."${a}",away_team_id.eq."${b}"),and(home_team_id.eq."${b}",away_team_id.eq."${a}")`),
  ]);
  const error = eloRows.error ?? historyA.error ?? historyB.error ?? meetings.error;
  if (error) throw error;
  const elo = (team: string) => eloRows.data?.find((row) => row.team_id === team)?.elo ?? 1500;
  const won = (row: Played, team: string) => (row.home_team_id === team) === (row.home_score > row.away_score);
  const decided = (rows: Played[] | null) => (rows ?? []).filter((row) => row.home_score !== row.away_score);
  const form = (rows: Played[] | null, team: string) => { const games = decided(rows); return games.length ? games.filter((row) => won(row, team)).length / games.length : 0.5; };
  const rest = (rows: Played[] | null) => rows?.[0] ? Math.min((Date.now() - Date.parse(rows[0].start_time)) / DAY, 30) : 30;
  const h2h = decided(meetings.data as Played[] | null);
  const eloDiff = (elo(a) - elo(b)) / 100;
  const features: Features = {
    listed_first: 0,
    elo_diff: eloDiff,
    form_diff: form(historyA.data as Played[], a) - form(historyB.data as Played[], b),
    h2h_diff: h2h.filter((row) => won(row, a)).length - h2h.filter((row) => won(row, b)).length,
    experience_diff: Math.log1p(historyA.count ?? 0) - Math.log1p(historyB.count ?? 0),
    rest_diff: (rest(historyA.data as Played[]) - rest(historyB.data as Played[])) / 10,
    elo_diff_bo: eloDiff * (bestOf - 1) / 2,
  };
  return { chance: probability(features, coefficients), features, elo: [elo(a), elo(b)] as const, meetings: h2h.length };
}
