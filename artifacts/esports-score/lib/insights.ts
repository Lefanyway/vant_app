import { supabase } from "@/lib/supabase";

export type Score = { accuracy: number; brier: number };
export type InsightTeam = { id: string; name: string; acronym?: string; logoUrl?: string };
export type Upcoming = { id: string; start_time: string; payload: { homeTeam: InsightTeam; awayTeam: InsightTeam; competition: { name: string } }; predictions: { home_win_prob: number } | null };
export type Ranked = { team_id: string; elo: number; name: string; logo_url?: string };

// Everything here comes straight from Supabase: the latest training run, the model's picks and its Elo table.
export async function fetchInsights() {
  const [run, upcoming, elo] = await Promise.all([
    supabase.from("model_runs").select("train_matches, test_matches, metrics, trained_at").order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("matches").select("id, start_time, payload, predictions(home_win_prob)").eq("status", "scheduled").gte("start_time", new Date().toISOString()).order("start_time").limit(10),
    supabase.from("team_elo").select("team_id, elo").order("elo", { ascending: false }).limit(10),
  ]);
  const error = run.error ?? upcoming.error ?? elo.error;
  if (error) throw error;
  const ids = (elo.data ?? []).map((row) => row.team_id);
  const teams = ids.length ? await supabase.from("teams").select("id, name, logo_url").in("id", ids) : { data: [] };
  const ranking: Ranked[] = (elo.data ?? []).map((row) => { const team = teams.data?.find((item) => item.id === row.team_id); return { team_id: row.team_id, elo: row.elo, name: team?.name ?? "Equipe", logo_url: team?.logo_url ?? undefined }; });
  return { run: run.data as { train_matches: number; test_matches: number; metrics: { model: Score; elo_only: Score; coin_flip: Score } } | null, upcoming: (upcoming.data ?? []) as unknown as Upcoming[], ranking };
}
