import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompetitionCard } from "@/components/CompetitionCard";
import { fetchMatches, localDateKey } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function Matches() {
  const colors = useColors(); const insets = useSafeAreaInsets();
  const today = new Date(); const todayKey = localDateKey(today);
  const minimumKey = localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const shiftDate = (days: number) => { const next = new Date(`${selectedDate}T12:00:00`); next.setDate(next.getDate() + days); const key = localDateKey(next); if (key >= minimumKey) setSelectedDate(key); };
  const selectedOffset = Math.round((Date.parse(`${selectedDate}T12:00:00`) - Date.parse(`${todayKey}T12:00:00`)) / 86_400_000);
  const selectedLabel = selectedOffset === 0 ? "Today" : selectedOffset === -1 ? "Yesterday" : selectedOffset === 1 ? "Tomorrow" : new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { day: "2-digit", month: "short" });
  const matchesQuery = useQuery({ queryKey: ["matches", "all", selectedDate], queryFn: () => fetchMatches(undefined, selectedDate) });
  const grouped = (matchesQuery.data ?? []).reduce<Record<string, NonNullable<typeof matchesQuery.data>>>((groups, match) => { (groups[match.tournament] ??= []).push(match); return groups; }, {});
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 18), paddingBottom: 100 }}>
    <Text style={[styles.title, { color: colors.foreground }]}>All matches</Text>
    <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Every series across Valorant, CS2 and LoL.</Text>
    <View style={styles.dateNav}>
      <Pressable onPress={() => shiftDate(-1)} disabled={selectedDate === minimumKey} hitSlop={8}><Feather name="chevron-left" size={18} color={selectedDate === minimumKey ? colors.border : colors.mutedForeground} /></Pressable>
      <Text style={[styles.dateLabel, { color: colors.foreground }]}>{selectedLabel}</Text>
      <Pressable onPress={() => shiftDate(1)} hitSlop={8}><Feather name="chevron-right" size={18} color={colors.mutedForeground} /></Pressable>
    </View>
    {matchesQuery.isLoading ? <View style={styles.state}><Text style={[styles.stateText, { color: colors.mutedForeground }]}>Loading matches…</Text></View>
      : matchesQuery.isError ? <View style={styles.state}><Text style={[styles.stateText, { color: colors.mutedForeground }]}>Couldn't load matches.</Text><Pressable onPress={() => matchesQuery.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View>
      : Object.keys(grouped).length === 0 ? <View style={styles.state}><Text style={[styles.stateText, { color: colors.mutedForeground }]}>No matches on this date.</Text></View>
      : Object.entries(grouped).map(([name, competitionMatches]) => <CompetitionCard key={name} name={name} game="All games" matches={competitionMatches} onMatchPress={(match) => router.push(`/match/${match.id}`)} />)}
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, paddingHorizontal: 16 }, title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.8 }, subtitle: { fontSize: 14, marginTop: 6 }, dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginVertical: 20 }, dateLabel: { fontSize: 14, fontWeight: "700", minWidth: 90, textAlign: "center" }, state: { alignItems: "center", padding: 24 }, stateText: { fontSize: 13, textAlign: "center" }, retry: { fontSize: 12, fontWeight: "600", marginTop: 8 } });
