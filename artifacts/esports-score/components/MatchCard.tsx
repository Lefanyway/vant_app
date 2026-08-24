import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Match } from "@/lib/data";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { TeamLink } from "@/components/TeamLink";

export function TeamBadge({ name, short, color, logoUrl }: { name: string; short: string; color: string; logoUrl?: string }) {
  return <View style={styles.teamBadge}><ResolvedLogo type="team" name={name} size={38} logoUrl={logoUrl} /></View>;
}

export function MatchCard({ match, onPress }: { match: Match; onPress: () => void }) {
  const colors = useColors();
  const { favoriteTeams, toggleFavorite } = useApp();
  const isFollowed = favoriteTeams.includes(match.teamA.id) || favoriteTeams.includes(match.teamB.id);
  return (
    <Pressable testID={`match-${match.id}`} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
      <View style={styles.cardTop}>
        <View style={styles.tournament}><View style={[styles.gameDot, { backgroundColor: match.teamA.color }]} /><Text style={[styles.tournamentText, { color: colors.mutedForeground }]}>{match.game}  ·  {match.tournament}</Text></View>
        <Pressable testID={`favorite-${match.id}`} onPress={() => toggleFavorite(match.teamA.id)} hitSlop={10}><Feather name={isFollowed ? "heart" : "heart"} size={17} color={isFollowed ? colors.primary : colors.mutedForeground} /></Pressable>
      </View>
      <View style={styles.cardMain}>
        <TeamLink team={match.teamA}><View style={styles.team}><TeamBadge {...match.teamA} /><Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>{match.teamA.name}</Text></View></TeamLink>
        <View style={styles.scoreColumn}>
          {match.status === "Live" ? <Text style={[styles.liveText, { color: colors.primary }]}>LIVE</Text> : <Text style={[styles.time, { color: colors.foreground }]}>{match.time}</Text>}
          {match.status !== "Upcoming" && <Text style={[styles.score, { color: colors.foreground }]}>{match.scoreA} <Text style={{ color: colors.mutedForeground }}>—</Text> {match.scoreB}</Text>}
          <Text style={[styles.format, { color: colors.mutedForeground }]}>{match.format}</Text>
        </View>
        <TeamLink team={match.teamB}><View style={[styles.team, styles.teamRight]}><TeamBadge {...match.teamB} /><Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>{match.teamB.name}</Text></View></TeamLink>
      </View>
      <View style={[styles.cardBottom, { borderTopColor: colors.border }]}><Text style={[styles.detail, { color: colors.mutedForeground }]}>{match.detail}</Text><Feather name="chevron-right" size={16} color={colors.mutedForeground} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  tournament: { flexDirection: "row", alignItems: "center", gap: 7 },
  gameDot: { width: 7, height: 7, borderRadius: 4 },
  tournamentText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  cardMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  team: { alignItems: "center", width: "34%", gap: 7 },
  teamRight: { alignItems: "center" },
  teamName: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  teamBadge: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  scoreColumn: { alignItems: "center", minWidth: 62 },
  liveText: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 2 },
  time: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  score: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  format: { fontSize: 10, fontWeight: "700" },
  cardBottom: { borderTopWidth: 1, marginTop: 16, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detail: { fontSize: 11 },
});