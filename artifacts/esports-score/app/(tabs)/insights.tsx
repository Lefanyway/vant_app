import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { MatchSimulator } from "@/components/MatchSimulator";
import { PredictionWhy } from "@/components/PredictionWhy";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { absoluteLogo } from "@/lib/api";
import { openMatch } from "@/lib/navigation";
import { confidence, fetchInsights, modelHit, type Coefficients, type Finished, type Upcoming } from "@/lib/insights";

const pct = (value: number) => `${Math.round(value * 100)}%`;

export default function Insights() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const query = useQuery({ queryKey: ["insights"], queryFn: fetchInsights, staleTime: 10 * 60_000 });
  const data = query.data;
  const [allResults, setAllResults] = useState(false);
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

        {data.results.length ? <>
          {section("Como o modelo foi")}
          <View style={[styles.dayCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.dayTitle, { color: colors.foreground }]}>Acertou {data.results.filter(modelHit).length} de {data.results.length} nos últimos 2 dias</Text>
            {(allResults ? data.results : data.results.slice(0, 5)).map((match, index) => <ResultRow key={match.id} match={match} first={index === 0} colors={colors} />)}
            {data.results.length > 5 ? <Pressable accessibilityRole="button" onPress={() => setAllResults(!allResults)} style={styles.more}><Text style={[styles.moreText, { color: colors.primary }]}>{allResults ? "Mostrar menos" : `Ver todas (${data.results.length})`}</Text></Pressable> : null}
          </View>
        </> : null}

        {section("Próximas partidas")}
        {data.upcoming.length ? byDay(data.upcoming).map(([day, matches]) => <View key={day} style={[styles.dayCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.dayTitle, { color: colors.foreground }]}>{day}</Text>
          {matches.map((match, index) => <PredictionRow key={match.id} match={match} first={index === 0} coefficients={data.run?.coefficients} colors={colors} />)}
        </View>) : <EmptyState title="Nenhuma partida agendada" />}

        {data.run?.coefficients ? <>{section("Simular confronto")}<MatchSimulator coefficients={data.run.coefficients} /></> : null}

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
function PredictionRow({ match, first, coefficients, colors }: { match: Upcoming; first: boolean; coefficients?: Coefficients; colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(false);
  const home = match.predictions?.home_win_prob;
  const features = match.predictions?.features;
  return <View style={!first && { borderTopWidth: 1, borderTopColor: colors.border }}>
    <PredictionLine match={match} home={home} colors={colors} />
    {home !== undefined ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} disabled={!features || !coefficients} style={styles.why}>
      <Text style={[styles.badge, { color: colors.foreground, backgroundColor: colors.secondary }]}>{confidence(home)}</Text>
      {features && coefficients ? <><Text style={[styles.whyText, { color: colors.primary }]}>Por quê?</Text><Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} /></> : null}
    </Pressable> : null}
    {open && features && coefficients ? <View style={styles.whyBody}><PredictionWhy features={features} coefficients={coefficients} home={match.payload.homeTeam.name.trim()} away={match.payload.awayTeam.name.trim()} /></View> : null}
  </View>;
}

function PredictionLine({ match, home, colors }: { match: Upcoming; home?: number; colors: ReturnType<typeof useColors> }) {
  const sides = [{ team: match.payload.homeTeam, chance: home }, { team: match.payload.awayTeam, chance: home === undefined ? undefined : 1 - home }];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${match.payload.homeTeam.name} contra ${match.payload.awayTeam.name}${home === undefined ? ", sem previsão" : `, ${pct(home)} a ${pct(1 - home)}`}`} onPress={() => openMatch(match.id)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}>
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

// A finished match: ✓ or ✗ for the model's pick, the winner in bold and the chance it had given.
function ResultRow({ match, first, colors }: { match: Finished; first: boolean; colors: ReturnType<typeof useColors> }) {
  const hit = modelHit(match);
  const home = match.predictions!.home_win_prob;
  const homeWon = match.home_score! > match.away_score!;
  const pick = home >= 0.5 ? match.payload.homeTeam : match.payload.awayTeam;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${hit ? "Acertou" : "Errou"}: ${match.payload.homeTeam.name} ${match.home_score} a ${match.away_score} ${match.payload.awayTeam.name}`} onPress={() => openMatch(match.id)} style={[styles.resultRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
    <View style={[styles.mark, { backgroundColor: hit ? colors.positive : colors.destructive }]}><Feather name={hit ? "check" : "x"} size={14} color="#FFFFFF" /></View>
    <View style={styles.teams}>
      <Text numberOfLines={1} style={[styles.resultTeams, { color: colors.foreground }]}><Text style={{ fontFamily: homeWon ? font.bold : font.medium }}>{match.payload.homeTeam.name.trim()}</Text> {match.home_score}–{match.away_score} <Text style={{ fontFamily: homeWon ? font.medium : font.bold }}>{match.payload.awayTeam.name.trim()}</Text></Text>
      <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.mutedForeground }]}>Favorito: {pick.name.trim()} ({pct(Math.max(home, 1 - home))})</Text>
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
  why: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 86, paddingBottom: 12, marginTop: -4 },
  badge: { fontSize: 11, fontFamily: font.semibold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: "hidden" },
  whyText: { fontSize: 12, fontFamily: font.semibold, marginLeft: 4 },
  whyBody: { paddingBottom: 14 },
  more: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 13, fontFamily: font.semibold },
  resultRow: { minHeight: 58, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  resultTeams: { fontSize: 13, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
  rank: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  position: { width: 18, fontSize: 13, fontFamily: font.bold, textAlign: "right" },
  rankName: { flex: 1, fontSize: 14, fontFamily: font.semibold },
  rankElo: { fontSize: 14, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
});
