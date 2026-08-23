import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Match } from "@/lib/data";
import { useColors } from "@/hooks/useColors";
import { MatchCard } from "@/components/MatchCard";
import { ResolvedLogo } from "@/components/ResolvedLogo";

export function CompetitionCard({ name, game, matches, onMatchPress }: { name: string; game: string; matches: Match[]; onMatchPress: (match: Match) => void }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.header}><View style={styles.logo}><ResolvedLogo type="competition" name={name} size={36} logoUrl={matches[0]?.competitionLogoUrl} /></View><View style={styles.heading}><Text style={[styles.name, { color: colors.foreground }]}>{name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{game}</Text></View><Pressable hitSlop={10}><Feather name="heart" size={17} color={colors.mutedForeground} /></Pressable></View>{matches.map((match) => <MatchCard key={match.id} match={match} onPress={() => onMatchPress(match)} />)}</View>;
}
const styles = StyleSheet.create({ card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 }, header: { flexDirection: "row", alignItems: "center", marginBottom: 14 }, logo: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, heading: { flex: 1, marginLeft: 10 }, name: { fontSize: 16, fontWeight: "700" }, meta: { fontSize: 12, marginTop: 3 } });