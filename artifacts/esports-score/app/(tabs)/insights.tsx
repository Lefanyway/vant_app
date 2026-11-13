import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { openMatch } from "@/lib/navigation";
import { supabase } from "@/lib/supabase";

type Score = { accuracy: number; brier: number };
type Team = { id: string; name: string; acronym?: string; logoUrl?: string };
type Upcoming = { id: string; start_time: string; payload: { homeTeam: Team; awayTeam: Team; competition: { name: string } }; predictions: { home_win_prob: number } | null };
type Ranked = { team_id: string; elo: number; name: string; logo_url?: string };

// Everything here comes straight from Supabase: the latest training run, the model's picks and its Elo table.
async function fetchInsights() {
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

const pct = (value: number) => `${Math.round(value * 100)}%`;

export default function Insights() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["insights"], queryFn: fetchInsights, staleTime: 10 * 60_000 });
  const data = query.data;
  const section = (title: string) => <Text style={[styles.section, { color: colors.mutedForeground }]}>{title}</Text>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 12, paddingBottom: 110 + insets.bottom }}>
      <Text style={[styles.title, { color: colors.foreground }]}>Previsões</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Modelo VANT: Elo + regressão logística</Text>
      {query.isLoading ? <ListSkeleton /> : query.isError || !data ? <EmptyState title="Não foi possível carregar" onRetry={() => void query.refetch()} /> : <>
        {data.run ? <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.metrics}>
            <Metric label="Modelo VANT" value={pct(data.run.metrics.model.accuracy)} highlight colors={colors} />
            <Metric label="Só Elo" value={pct(data.run.metrics.elo_only.accuracy)} colors={colors} />
            <Metric label="Sem modelo" value={pct(data.run.metrics.coin_flip.accuracy)} colors={colors} />
          </View>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>Acertos em {data.run.test_matches.toLocaleString("pt-BR")} partidas, cada uma prevista só com o que aconteceu antes dela.</Text>
        </View> : null}

        {section("Próximas partidas")}
        {data.upcoming.length ? data.upcoming.map((match) => {
          const home = match.predictions?.home_win_prob;
          const favorite = home === undefined ? null : home >= 0.5 ? match.payload.homeTeam : match.payload.awayTeam;
          return <Pressable key={match.id} accessibilityRole="button" onPress={() => openMatch(match.id)} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}>
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>{match.payload.homeTeam.name} vs {match.payload.awayTeam.name}</Text>
              <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.mutedForeground }]}>{new Date(match.start_time).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {match.payload.competition.name}</Text>
            </View>
            {favorite && home !== undefined ? <View style={styles.pick}><Text style={[styles.pickValue, { color: colors.primary }]}>{pct(Math.max(home, 1 - home))}</Text><Text numberOfLines={1} style={[styles.rowMeta, { color: colors.mutedForeground }]}>{favorite.acronym ?? favorite.name}</Text></View> : null}
          </Pressable>;
        }) : <EmptyState title="Nenhuma partida agendada" />}

        {section("Ranking Elo")}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {data.ranking.map((team, index) => <View key={team.team_id} style={styles.rank}>
            <Text style={[styles.position, { color: colors.mutedForeground }]}>{index + 1}</Text>
            <ResolvedLogo type="team" name={team.name} entityId={team.team_id} logoUrl={team.logo_url} size={28} />
            <Text numberOfLines={1} style={[styles.rankName, { color: colors.foreground }]}>{team.name.trim()}</Text>
            <Text style={[styles.rankElo, { color: colors.foreground }]}>{Math.round(team.elo)}</Text>
          </View>)}
        </View>
      </>}
    </ScrollView>
  );
}

function Metric({ label, value, highlight = false, colors }: { label: string; value: string; highlight?: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: highlight ? colors.primary : colors.foreground }]}>{value}</Text><Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: font.bold },
  subtitle: { fontSize: 13, fontFamily: font.medium, marginTop: 4, marginBottom: 14 },
  section: { fontSize: 15, fontFamily: font.semibold, marginTop: 24, marginBottom: 9 },
  card: { borderRadius: 22, padding: 16, gap: 10 },
  metrics: { flexDirection: "row", justifyContent: "space-between" },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 24, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  note: { fontSize: 12, lineHeight: 17, fontFamily: font.medium, textAlign: "center" },
  row: { borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 14, fontFamily: font.semibold },
  rowMeta: { fontSize: 11, fontFamily: font.medium },
  pick: { alignItems: "flex-end", maxWidth: 90 },
  pickValue: { fontSize: 18, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  rank: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  position: { width: 18, fontSize: 13, fontFamily: font.bold, textAlign: "right" },
  rankName: { flex: 1, fontSize: 14, fontFamily: font.semibold },
  rankElo: { fontSize: 14, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
});
