import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Scoreboard } from "@/components/Scoreboard";
import { SwipeTabs } from "@/components/SwipeTabs";
import { CompetitionDirectory } from "@/components/CompetitionDirectory";
import { MobileHeader, EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { useColors } from "@/hooks/useColors";
import { fetchCompetitions } from "@/lib/api";
export default function Home() {
  const colors = useColors(); const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"matches" | "competitions">("matches");
  const competitions = useQuery({ queryKey: ["competitions", "valorant"], queryFn: () => fetchCompetitions("valorant"), enabled: mode === "competitions", staleTime: 10 * 60_000 });
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <MobileHeader />
    <View style={[styles.segmentWrap, { backgroundColor: colors.card }]}><View style={[styles.segment, { backgroundColor: colors.background }]}>{(["matches", "competitions"] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === mode }} onPress={() => setMode(key)} style={[styles.segmentItem, { backgroundColor: key === mode ? "#ECEDEF" : "transparent" }]}><Text style={[styles.segmentText, { color: key === mode ? "#181E20" : colors.foreground }]}>{key === "matches" ? "PARTIDAS" : "COMPETIÇÕES"}</Text></Pressable>)}</View></View>
    <SwipeTabs tabs={["matches", "competitions"] as const} selected={mode} onChange={setMode}>
    {mode === "matches" ? <View style={{ flex: 1, paddingHorizontal: 8, paddingBottom: 108 + insets.bottom }}><Scoreboard showSearch={false} showIdentity={false} /></View> : <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 14, paddingBottom: 110 + insets.bottom }}>{competitions.isLoading ? <ListSkeleton /> : competitions.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => void competitions.refetch()} /> : competitions.data?.length ? <CompetitionDirectory competitions={competitions.data} /> : <EmptyState title="Nenhuma competição disponível" />}</ScrollView>}
    </SwipeTabs>
  </View>;
}
const styles = StyleSheet.create({ segmentWrap: { paddingHorizontal: 10, paddingVertical: 9 }, segment: { flexDirection: "row", borderRadius: 30, padding: 3 }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 24, alignItems: "center", justifyContent: "center" }, segmentText: { fontSize: 13, fontWeight: "700" } });
