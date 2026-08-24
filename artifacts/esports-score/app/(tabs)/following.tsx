import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { TeamBadge } from "@/components/MatchCard";
import { fetchMatches, fetchTeams, localDateKey } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { TeamLink } from "@/components/TeamLink";

const options = [{ key: "before30", label: "30 minutes before" }, { key: "before5", label: "5 minutes before" }, { key: "start", label: "When match starts" }, { key: "result", label: "Final result" }] as const;

export default function Following() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const { favoriteTeams, toggleFavorite, notifications, toggleNotification } = useApp();
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const upcomingQuery = useQuery({ queryKey: ["matches", "all", localDateKey(new Date())], queryFn: () => fetchMatches() });
  const followed = (teamsQuery.data ?? []).filter((team) => favoriteTeams.includes(team.id));
  const upNext = (upcomingQuery.data ?? []).filter((match) => match.status !== "Finished" && followed.some((team) => team.id === match.teamA.id || team.id === match.teamB.id)).slice(0, 5);
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 18), paddingBottom: 100 }}>
    <View style={styles.header}><View><Text style={[styles.title, { color: colors.foreground }]}>Following</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Teams and alerts you care about.</Text></View><Feather name="settings" size={19} color={colors.mutedForeground} /></View>
    <Text style={[styles.label, { color: colors.mutedForeground }]}>TEAMS</Text>
    {teamsQuery.isLoading ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Loading teams…</Text>
      : teamsQuery.isError ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Couldn't load teams.</Text>
       : followed.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Follow a team from any match to see it here.</Text>
       : followed.map((team) => <View key={team.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}><TeamLink team={team} compact><TeamBadge {...team} /><View style={{ flex: 1 }}><Text style={[styles.team, { color: colors.foreground }]}>{team.name}</Text><Text style={[styles.game, { color: colors.mutedForeground }]}>{team.game}</Text></View></TeamLink><Pressable onPress={() => toggleFavorite(team.id)}><Feather name="heart" size={18} color={colors.primary} /></Pressable></View>)}
    <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>{options.map((item, index) => <View key={item.key} style={[styles.option, index < options.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}><Text style={[styles.optionText, { color: colors.foreground }]}>{item.label}</Text><Switch value={notifications[item.key]} onValueChange={() => toggleNotification(item.key)} trackColor={{ false: colors.secondary, true: colors.accent }} thumbColor={notifications[item.key] ? colors.primary : colors.mutedForeground} /></View>)}</View>
    <View style={[styles.spoiler, { backgroundColor: colors.accent, borderColor: colors.primary }]}><View style={{ flex: 1 }}><Text style={[styles.optionText, { color: colors.foreground }]}>Spoiler-free mode</Text><Text style={[styles.game, { color: colors.mutedForeground }]}>Hide score and winner from alerts</Text></View><Switch value={notifications.spoilerFree} onValueChange={() => toggleNotification("spoilerFree")} trackColor={{ false: colors.secondary, true: colors.primary }} thumbColor={colors.primaryForeground} /></View>
    <Text style={[styles.label, { color: colors.mutedForeground }]}>UP NEXT FOR YOU</Text>
    {upNext.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No upcoming matches for your teams today.</Text> : upNext.map((match) => <Pressable key={match.id} onPress={() => router.push(`/match/${match.id}`)} style={[styles.next, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.game, { color: colors.mutedForeground }]}>{match.time} · {match.tournament}</Text><Text style={[styles.nextTeams, { color: colors.foreground }]}>{match.teamA.name}  <Text style={{ color: colors.mutedForeground }}>vs</Text>  {match.teamB.name}</Text></Pressable>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, paddingHorizontal: 16 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }, subtitle: { fontSize: 14, marginTop: 6 }, label: { fontSize: 10, fontWeight: "700", letterSpacing: 1.1, marginTop: 28, marginBottom: 10 }, row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }, team: { fontSize: 14, fontWeight: "600" }, game: { fontSize: 12, marginTop: 3 }, empty: { fontSize: 14, paddingVertical: 18 }, panel: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 }, option: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, optionText: { fontSize: 14, fontWeight: "500" }, spoiler: { marginTop: 12, borderWidth: 1, borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center" }, next: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 8 }, nextTeams: { fontSize: 15, fontWeight: "600", marginTop: 8 } });
