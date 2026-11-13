import { Pressable, StyleSheet, Text, View } from "react-native";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import type { Match } from "@/lib/data";
import { openMatch } from "@/lib/navigation";

const day = (iso?: string) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "—";

// One finished match on one line: who it was against, the score and who won.
// With a focus team the row reads from its side (opponent, its score first, V/D);
// without one it shows both teams and bolds the winner.
export function ResultRow({ match, focusTeamId, first = false }: { match: Match; focusTeamId?: string; first?: boolean }) {
  const colors = useColors();
  const scored = typeof match.scoreA === "number" && typeof match.scoreB === "number";
  const border = !first ? { borderTopWidth: 1, borderTopColor: colors.border } : null;
  if (focusTeamId) {
    const home = match.teamA.id === focusTeamId;
    const opponent = home ? match.teamB : match.teamA;
    const own = home ? match.scoreA : match.scoreB;
    const other = home ? match.scoreB : match.scoreA;
    const result = !scored ? null : own! > other! ? "V" : own! < other! ? "D" : "E";
    const tone = result === "V" ? colors.positive : result === "D" ? colors.destructive : colors.mutedForeground;
    return <Pressable accessibilityRole="button" accessibilityLabel={`${result === "V" ? "Vitória" : result === "D" ? "Derrota" : "Partida"} contra ${opponent.name}${scored ? `, ${own} a ${other}` : ""}`} onPress={() => openMatch(match.id, match)} style={[styles.row, border]}>
      <Text style={[styles.date, { color: colors.mutedForeground }]}>{day(match.startTime)}</Text>
      <ResolvedLogo type="team" name={opponent.name} entityId={opponent.id} logoUrl={opponent.logoUrl} size={30} />
      <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{opponent.name}</Text>
      <Text style={[styles.score, { color: colors.foreground }]}>{scored ? `${own}–${other}` : "—"}</Text>
      <View style={[styles.badge, { backgroundColor: result ? `${tone}26` : colors.secondary }]}><Text style={[styles.badgeText, { color: tone }]}>{result ?? "—"}</Text></View>
    </Pressable>;
  }
  const aWon = scored && match.scoreA! > match.scoreB!;
  const bWon = scored && match.scoreB! > match.scoreA!;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${match.teamA.name} ${scored ? `${match.scoreA} a ${match.scoreB}` : "contra"} ${match.teamB.name}`} onPress={() => openMatch(match.id, match)} style={[styles.row, border]}>
    <Text style={[styles.date, { color: colors.mutedForeground }]}>{day(match.startTime)}</Text>
    <View style={styles.side}>
      <ResolvedLogo type="team" name={match.teamA.name} entityId={match.teamA.id} logoUrl={match.teamA.logoUrl} size={26} />
      <Text numberOfLines={1} style={[styles.sideName, { color: aWon || !scored ? colors.foreground : colors.mutedForeground, fontWeight: aWon ? "700" : "500" }]}>{match.teamA.name}</Text>
    </View>
    <Text style={[styles.score, { color: colors.foreground }]}>{scored ? `${match.scoreA}–${match.scoreB}` : "vs"}</Text>
    <View style={[styles.side, styles.sideEnd]}>
      <Text numberOfLines={1} style={[styles.sideName, styles.right, { color: bWon || !scored ? colors.foreground : colors.mutedForeground, fontWeight: bWon ? "700" : "500" }]}>{match.teamB.name}</Text>
      <ResolvedLogo type="team" name={match.teamB.name} entityId={match.teamB.id} logoUrl={match.teamB.logoUrl} size={26} />
    </View>
  </Pressable>;
}

// The card that holds a list of ResultRows.
export function ResultList({ matches, focusTeamId }: { matches: Match[]; focusTeamId?: string }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card }]}>{matches.map((match, index) => <ResultRow key={match.id} match={match} focusTeamId={focusTeamId} first={index === 0} />)}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10 },
  date: { width: 62, fontSize: 12 },
  name: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600" },
  score: { minWidth: 34, textAlign: "center", fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  badge: { width: 32, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 14, fontWeight: "700" },
  side: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  sideEnd: { justifyContent: "flex-end" },
  sideName: { flexShrink: 1, fontSize: 14 },
  right: { textAlign: "right" },
});
