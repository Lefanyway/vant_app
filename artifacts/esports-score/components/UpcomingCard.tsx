import { Pressable, StyleSheet, Text, View } from "react-native";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import type { Match } from "@/lib/data";
import { listTeamLabel } from "@/lib/matches";
import { openMatch } from "@/lib/navigation";

const statusLabel = (match: Match) => match.status === "Live" ? "Ao vivo" : match.status === "Postponed" ? "Adiada" : match.status === "Cancelled" ? "Cancelada" : "Agendada";

// The one way an upcoming match is shown: competition on top, date on the left, both teams big, status on the right.
export function UpcomingCard({ match }: { match: Match }) {
  const colors = useColors();
  const start = match.startTime ? new Date(match.scheduledTime ?? match.startTime) : null;
  const live = match.status === "Live";
  return <Pressable accessibilityRole="button" accessibilityLabel={`${match.teamA.name} contra ${match.teamB.name}, ${start ? start.toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "data a definir"}`} onPress={() => openMatch(match.id, match)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
    <Text numberOfLines={1} style={[styles.competition, { color: colors.mutedForeground }]}>{match.stage && !match.tournament.includes(match.stage) ? `${match.tournament} · ${match.stage}` : match.tournament}</Text>
    <View style={styles.body}>
      <View style={styles.when}>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{start ? start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "A definir"}</Text>
        {start ? <Text style={[styles.time, { color: colors.foreground }]}>{start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text> : null}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Side team={match.teamA} />
      <View style={[styles.vs, { backgroundColor: colors.secondary }]}><Text style={[styles.vsText, { color: colors.mutedForeground }]}>vs</Text></View>
      <Side team={match.teamB} />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={[styles.status, { backgroundColor: live ? `${colors.live}26` : colors.secondary }]}><Text style={[styles.statusText, { color: live ? colors.live : colors.mutedForeground }]}>{statusLabel(match)}</Text></View>
    </View>
  </Pressable>;
}

function Side({ team }: { team: Match["teamA"] }) {
  const colors = useColors();
  return <View style={styles.side}>
    <ResolvedLogo type="team" name={team.name} entityId={team.id} logoUrl={team.logoUrl} size={40} />
    <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{listTeamLabel(team, 14)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12, marginBottom: 10 },
  competition: { fontSize: 12, fontWeight: "600" },
  body: { flexDirection: "row", alignItems: "center", gap: 8 },
  when: { width: 52, gap: 4 },
  date: { fontSize: 12 },
  time: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  divider: { width: 1, alignSelf: "stretch" },
  side: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  name: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  vs: { paddingHorizontal: 8, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vsText: { fontSize: 11, fontWeight: "700" },
  status: { paddingHorizontal: 8, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 11, fontWeight: "600" },
});
