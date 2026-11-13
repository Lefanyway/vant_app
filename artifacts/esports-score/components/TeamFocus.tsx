import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ListSkeleton } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import { fetchTeamMatches, toMatch } from "@/lib/api";
import type { Match } from "@/lib/data";
import { openMatch } from "@/lib/navigation";

const when = (iso?: string) => {
  if (!iso) return "A definir";
  const date = new Date(iso);
  const today = new Date();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === today.toDateString() ? `Hoje, ${time}` : `${date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}, ${time}`;
};

// One followed team at a glance: its next match and its latest results, told from its side.
export function TeamFocus({ teamId, onSeeAll }: { teamId: string; onSeeAll: () => void }) {
  const colors = useColors();
  const next = useQuery({ queryKey: ["team-focus", teamId, "upcoming"], queryFn: () => fetchTeamMatches(teamId, "upcoming"), staleTime: 5 * 60_000 });
  const past = useQuery({ queryKey: ["team-focus", teamId, "finished"], queryFn: () => fetchTeamMatches(teamId, "finished"), staleTime: 5 * 60_000 });
  const upcoming = (next.data?.matches ?? []).map(toMatch).filter((match) => match.startTime).sort((a, b) => Date.parse(a.startTime!) - Date.parse(b.startTime!))[0];
  const recent = (past.data?.matches ?? []).map(toMatch).sort((a, b) => Date.parse(b.startTime ?? "0") - Date.parse(a.startTime ?? "0")).slice(0, 5);
  return <View>
    <View style={styles.heading}>
      <Text style={[styles.title, { color: colors.foreground }]}>Próxima partida</Text>
      {upcoming ? <View style={styles.when}><Feather name="calendar" size={15} color={colors.mutedForeground} /><Text style={[styles.whenText, { color: colors.mutedForeground }]}>{when(upcoming.startTime)}</Text></View> : null}
    </View>
    {next.isLoading ? <ListSkeleton count={1} /> : upcoming ? <Pressable accessibilityRole="button" accessibilityLabel={`${upcoming.teamA.name} contra ${upcoming.teamB.name}, ${when(upcoming.startTime)}`} onPress={() => openMatch(upcoming.id, upcoming)} style={[styles.nextCard, { backgroundColor: colors.card }]}>
      <Side team={upcoming.teamA} />
      <View style={[styles.vs, { backgroundColor: colors.secondary }]}><Text style={[styles.vsText, { color: colors.mutedForeground }]}>VS</Text></View>
      <Side team={upcoming.teamB} />
    </Pressable> : <Text style={[styles.none, { color: colors.mutedForeground }]}>Nenhuma partida marcada por enquanto.</Text>}

    <View style={[styles.heading, { marginTop: 24 }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Partidas recentes</Text>
      <Pressable testID={`team-link-${teamId}`} accessibilityRole="link" accessibilityLabel="Ver todas as partidas da equipe" onPress={onSeeAll} hitSlop={8} style={styles.when}><Text style={[styles.seeAll, { color: colors.primary }]}>Ver tudo</Text><Feather name="arrow-right" size={16} color={colors.primary} /></Pressable>
    </View>
    {past.isLoading ? <ListSkeleton count={1} /> : recent.length ? <View style={[styles.list, { backgroundColor: colors.card }]}>
      {recent.map((match, index) => <Recent key={match.id} match={match} teamId={teamId} first={index === 0} />)}
    </View> : <Text style={[styles.none, { color: colors.mutedForeground }]}>Sem partidas recentes.</Text>}
  </View>;
}

function Side({ team }: { team: Match["teamA"] }) {
  const colors = useColors();
  return <View style={styles.side}>
    <ResolvedLogo type="team" name={team.name} entityId={team.id} logoUrl={team.logoUrl} size={60} />
    <Text numberOfLines={1} style={[styles.sideName, { color: colors.foreground }]}>{team.name}</Text>
  </View>;
}

function Recent({ match, teamId, first }: { match: Match; teamId: string; first: boolean }) {
  const colors = useColors();
  const home = match.teamA.id === teamId;
  const opponent = home ? match.teamB : match.teamA;
  const own = home ? match.scoreA : match.scoreB;
  const other = home ? match.scoreB : match.scoreA;
  const scored = typeof own === "number" && typeof other === "number";
  const result = !scored ? null : own > other ? "V" : own < other ? "D" : "E";
  const tone = result === "V" ? colors.positive : result === "D" ? colors.destructive : colors.mutedForeground;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${result === "V" ? "Vitória" : result === "D" ? "Derrota" : "Partida"} contra ${opponent.name}${scored ? `, ${own} a ${other}` : ""}`} onPress={() => openMatch(match.id, match)} style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
    <Text style={[styles.date, { color: colors.mutedForeground }]}>{match.startTime ? new Date(match.startTime).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "—"}</Text>
    <ResolvedLogo type="team" name={opponent.name} entityId={opponent.id} logoUrl={opponent.logoUrl} size={32} />
    <Text numberOfLines={1} style={[styles.opponent, { color: colors.foreground }]}>{opponent.name}</Text>
    <Text style={[styles.score, { color: colors.foreground }]}>{scored ? `${own}–${other}` : "—"}</Text>
    <View style={[styles.badge, { backgroundColor: result ? `${tone}26` : colors.secondary }]}><Text style={[styles.badgeText, { color: tone }]}>{result ?? "—"}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingHorizontal: 4 },
  title: { fontSize: 20, fontWeight: "700" },
  when: { flexDirection: "row", alignItems: "center", gap: 6 },
  whenText: { fontSize: 14 },
  seeAll: { fontSize: 15, fontWeight: "600" },
  nextCard: { borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  side: { flex: 1, minWidth: 0, alignItems: "center", gap: 10 },
  sideName: { fontSize: 16, fontWeight: "700" },
  vs: { width: 46, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  vsText: { fontSize: 12, fontWeight: "700" },
  list: { borderRadius: 18, paddingHorizontal: 14 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  date: { width: 70, fontSize: 13 },
  opponent: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600" },
  score: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  badge: { width: 34, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 15, fontWeight: "700" },
  none: { fontSize: 14, paddingHorizontal: 4, paddingVertical: 8 },
});
