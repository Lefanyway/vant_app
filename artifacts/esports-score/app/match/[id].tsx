import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchMatch } from "@/lib/api";
import { TeamBadge } from "@/components/MatchCard";
import { useColors } from "@/hooks/useColors";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const colors = useColors(); const insets = useSafeAreaInsets();
  const matchQuery = useQuery({ queryKey: ["match", id], queryFn: () => fetchMatch(String(id)), enabled: Boolean(id), refetchInterval: (query) => query.state.data?.status === "Live" ? 30_000 : false });
  const match = matchQuery.data;
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 14), paddingBottom: 50 }}>
    <View style={styles.nav}><Feather name="arrow-left" size={21} color={colors.foreground} onPress={() => router.back()} /><Text style={[styles.navTitle, { color: colors.foreground }]}>Match center</Text><View style={{ width: 21 }} /></View>
    {matchQuery.isLoading ? <Text style={[styles.message, { color: colors.mutedForeground }]}>Loading match…</Text>
      : matchQuery.isError || !match ? <View style={styles.errorBox}><Text style={[styles.message, { color: colors.mutedForeground }]}>Couldn't load this match.</Text><Pressable onPress={() => matchQuery.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View>
      : <>
          <Text style={[styles.tournament, { color: colors.mutedForeground }]}>{match.tournament}</Text>
          <View style={styles.teams}>
            <View style={styles.detailTeam}><TeamBadge {...match.teamA} /><Text style={[styles.detailName, { color: colors.foreground }]}>{match.teamA.name}</Text></View>
            <View style={styles.bigScore}>
              <Text style={[styles.score, { color: colors.foreground }]}>{match.scoreA ?? "—"} <Text style={{ color: colors.mutedForeground }}>×</Text> {match.scoreB ?? "—"}</Text>
              <Text style={[styles.status, { color: match.status === "Live" ? colors.primary : colors.mutedForeground }]}>{match.status === "Live" ? "LIVE" : match.status === "Finished" ? "FINAL" : match.time}</Text>
            </View>
            <View style={styles.detailTeam}><TeamBadge {...match.teamB} /><Text style={[styles.detailName, { color: colors.foreground }]}>{match.teamB.name}</Text></View>
          </View>
          <View style={[styles.info, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <InfoRow label="GAME" value={match.game} />
            <InfoRow label="FORMAT" value={match.format} />
            <InfoRow label="STATUS" value={match.detail} />
          </View>
          {match.status === "Live" && <Text style={[styles.telemetryNote, { color: colors.mutedForeground }]}>Live score from the official feed. In-game telemetry isn't available on the current plan.</Text>}
        </>}
  </ScrollView>;
}
function InfoRow({ label, value }: { label: string; value: string }) { const colors = useColors(); return <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, paddingHorizontal: 16 }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }, navTitle: { fontSize: 14, fontWeight: "600" }, tournament: { fontSize: 12, fontWeight: "500", textAlign: "center" }, teams: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 26 }, detailTeam: { alignItems: "center", width: "29%", gap: 8 }, detailName: { fontSize: 14, fontWeight: "600", textAlign: "center" }, bigScore: { alignItems: "center" }, score: { fontSize: 24, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] }, status: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: 4 }, message: { fontSize: 14, textAlign: "center", marginTop: 40 }, errorBox: { alignItems: "center" }, retry: { fontSize: 13, fontWeight: "600", marginTop: 10, textAlign: "center" }, info: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 }, infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 }, infoLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 }, infoValue: { fontSize: 13, fontWeight: "600" }, telemetryNote: { fontSize: 12, textAlign: "center", marginTop: 18, lineHeight: 18 } });
