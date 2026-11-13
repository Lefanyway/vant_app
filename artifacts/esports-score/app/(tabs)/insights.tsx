import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { absoluteLogo } from "@/lib/api";
import { openMatch } from "@/lib/navigation";
import { fetchInsights, type Upcoming } from "@/lib/insights";

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
        {data.upcoming.length ? byDay(data.upcoming).map(([day, matches]) => <View key={day} style={[styles.dayCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.dayTitle, { color: colors.foreground }]}>{day}</Text>
          {matches.map((match, index) => <PredictionRow key={match.id} match={match} first={index === 0} colors={colors} />)}
        </View>) : <EmptyState title="Nenhuma partida agendada" />}

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

// One card per day, in start order, so the list reads like a schedule.
function byDay(matches: Upcoming[]) {
  const days = new Map<string, Upcoming[]>();
  for (const match of [...matches].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))) {
    const date = new Date(match.start_time);
    const label = `${date.toLocaleDateString("pt-BR", { weekday: "short" })} · ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
    days.set(label, [...(days.get(label) ?? []), match]);
  }
  return [...days.entries()];
}

// Time on the left, both teams stacked, and each team's chance lined up on the right.
function PredictionRow({ match, first, colors }: { match: Upcoming; first: boolean; colors: ReturnType<typeof useColors> }) {
  const home = match.predictions?.home_win_prob;
  const sides = [{ team: match.payload.homeTeam, chance: home }, { team: match.payload.awayTeam, chance: home === undefined ? undefined : 1 - home }];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${match.payload.homeTeam.name} contra ${match.payload.awayTeam.name}${home === undefined ? ", sem previsão" : `, ${pct(home)} a ${pct(1 - home)}`}`} onPress={() => openMatch(match.id)} style={({ pressed }) => [styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }, { opacity: pressed ? 0.75 : 1 }]}>
    <View style={styles.when}>
      <Text style={[styles.time, { color: colors.foreground }]}>{new Date(match.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
      <Text numberOfLines={2} style={[styles.rowMeta, { color: colors.mutedForeground }]}>{match.payload.competition.name}</Text>
    </View>
    <View style={styles.teams}>
      {sides.map(({ team, chance }) => {
        const favorite = chance !== undefined && chance >= 0.5;
        return <View key={team.id} style={styles.teamLine}>
          <ResolvedLogo type="team" name={team.name} entityId={team.id} logoUrl={absoluteLogo(team.logoUrl)} size={24} />
          <Text numberOfLines={1} style={[styles.teamName, { color: colors.foreground }]}>{team.name.trim()}</Text>
          <Text style={[styles.chance, { color: favorite ? colors.primary : colors.mutedForeground, fontFamily: favorite ? font.bold : font.medium }]}>{chance === undefined ? "—" : pct(chance)}</Text>
        </View>;
      })}
    </View>
  </Pressable>;
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
  dayCard: { borderRadius: 22, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, marginBottom: 12 },
  dayTitle: { fontSize: 15, fontFamily: font.bold, marginBottom: 2 },
  row: { minHeight: 72, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  when: { width: 74, gap: 3 },
  time: { fontSize: 14, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  rowMeta: { fontSize: 11, fontFamily: font.medium },
  teams: { flex: 1, minWidth: 0, gap: 8 },
  teamLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamName: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: font.semibold },
  chance: { width: 44, textAlign: "right", fontSize: 14, fontVariant: ["tabular-nums"] },
  rank: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  position: { width: 18, fontSize: 13, fontFamily: font.bold, textAlign: "right" },
  rankName: { flex: 1, fontSize: 14, fontFamily: font.semibold },
  rankElo: { fontSize: 14, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
});
