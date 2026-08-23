import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchSearch } from "@/lib/api";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";

export default function Search() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const onChange = (value: string) => { setQuery(value); clearTimeout((onChange as { timer?: ReturnType<typeof setTimeout> }).timer); (onChange as { timer?: ReturnType<typeof setTimeout> }).timer = setTimeout(() => setDebounced(value.trim()), 350); };
  const searchQuery = useQuery({ queryKey: ["search", debounced], queryFn: () => fetchSearch(debounced), enabled: debounced.length > 0 });
  const teams = (searchQuery.data ?? []).filter((item) => item.type === "team");
  const competitions = (searchQuery.data ?? []).filter((item) => item.type === "competition");
  const gameLabel = (id?: string) => id === "cs2" ? "CS2" : id === "lol" ? "League of Legends" : id === "valorant" ? "Valorant" : "";
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 18), paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
    <Text style={[styles.title, { color: colors.foreground }]}>Search</Text>
    <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="search" size={18} color={colors.mutedForeground} /><TextInput value={query} onChangeText={onChange} placeholder="Teams and competitions" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} autoCapitalize="none" /></View>
    {query.length === 0 ? <View style={styles.suggestions}><Text style={[styles.caption, { color: colors.mutedForeground }]}>TRY SEARCHING</Text>{["LOUD", "FURIA", "Sentinels", "T1", "Fnatic", "Gen.G"].map((x) => <Pressable key={x} onPress={() => onChange(x)} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.chipText, { color: colors.foreground }]}>{x}</Text></Pressable>)}</View>
      : searchQuery.isLoading ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Searching…</Text>
      : searchQuery.isError ? <View><Text style={[styles.empty, { color: colors.mutedForeground }]}>Couldn't load results.</Text><Pressable onPress={() => searchQuery.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View>
      : <>
          {teams.length > 0 && <SearchGroup title="TEAMS">{teams.map((team) => <View key={team.id} style={[styles.result, { borderBottomColor: colors.border }]}><ResolvedLogo type="team" name={team.name} logoUrl={team.logoUrl} size={34} /><View><Text style={[styles.resultName, { color: colors.foreground }]}>{team.name}</Text><Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{gameLabel(team.gameId)}</Text></View></View>)}</SearchGroup>}
          {competitions.length > 0 && <SearchGroup title="COMPETITIONS">{competitions.map((competition) => <View key={competition.id} style={[styles.result, { borderBottomColor: colors.border }]}><ResolvedLogo type="competition" name={competition.name} logoUrl={competition.logoUrl} size={34} /><View><Text style={[styles.resultName, { color: colors.foreground }]}>{competition.name}</Text><Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{gameLabel(competition.gameId)}</Text></View></View>)}</SearchGroup>}
          {teams.length + competitions.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>No results for “{query}”.</Text>}
        </>}
  </ScrollView>;
}
function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) { const colors = useColors(); return <View style={styles.group}><Text style={[styles.caption, { color: colors.mutedForeground }]}>{title}</Text>{children}</View>; }
const styles = StyleSheet.create({ screen: { flex: 1, paddingHorizontal: 16 }, title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.8, marginBottom: 18 }, search: { height: 50, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 }, input: { flex: 1, fontSize: 14 }, suggestions: { marginTop: 28 }, group: { marginTop: 24 }, caption: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }, chip: { borderWidth: 1, borderRadius: 11, padding: 14, marginBottom: 8 }, chipText: { fontSize: 14, fontWeight: "600" }, result: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, paddingVertical: 15 }, resultName: { fontSize: 15, fontWeight: "700" }, resultMeta: { fontSize: 11, marginTop: 3 }, empty: { fontSize: 14, marginTop: 24 }, retry: { fontSize: 12, fontWeight: "600", marginTop: 8 } });
