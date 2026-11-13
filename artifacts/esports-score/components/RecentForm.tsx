import { Pressable, StyleSheet, Text, View } from "react-native";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import type { Match } from "@/lib/data";
import { openMatch } from "@/lib/navigation";

// The last five results at a glance: the score from the team's side (green win, red loss, gray draw) over the opponent's logo.
export function RecentForm({ matches, teamId }: { matches: Match[]; teamId: string }) {
  const colors = useColors();
  const recent = [...matches].sort((a, b) => Date.parse(a.startTime ?? "0") - Date.parse(b.startTime ?? "0")).slice(-5);
  return <View style={[styles.card, { backgroundColor: colors.card }]}>
    <Text style={[styles.title, { color: colors.foreground }]}>Forma recente</Text>
    <View style={styles.row}>
      {recent.map((match) => {
        const home = match.teamA.id === teamId;
        const opponent = home ? match.teamB : match.teamA;
        const own = home ? match.scoreA : match.scoreB;
        const other = home ? match.scoreB : match.scoreA;
        const scored = typeof own === "number" && typeof other === "number";
        const tone = !scored ? colors.secondary : own > other ? colors.positive : own < other ? colors.destructive : "#8A9096";
        return <Pressable key={match.id} accessibilityRole="button" accessibilityLabel={`${scored ? (own > other ? "Vitória" : own < other ? "Derrota" : "Empate") : "Partida"} contra ${opponent.name}${scored ? `, ${own} a ${other}` : ""}`} onPress={() => openMatch(match.id, match)} style={styles.item}>
          <View style={[styles.pill, { backgroundColor: tone }]}><Text style={styles.pillText}>{scored ? `${own} - ${other}` : "—"}</Text></View>
          <View style={styles.logo}><ResolvedLogo type="team" name={opponent.name} entityId={opponent.id} logoUrl={opponent.logoUrl} size={36} /></View>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 10, marginTop: 24, gap: 14 },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-around" },
  item: { alignItems: "center", gap: 10, minWidth: 52 },
  pill: { minWidth: 52, height: 26, borderRadius: 6, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  pillText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  logo: { borderRadius: 18, overflow: "hidden" },
});
