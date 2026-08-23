import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchMatchDetails, type MatchDetails } from "@/lib/api";
import type { Match } from "@/lib/data";
import { TeamBadge } from "@/components/MatchCard";
import { useColors } from "@/hooks/useColors";

type Tab = "Overview" | "Performance" | "Economy" | "H2H";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Overview");
  const detailsQuery = useQuery({ queryKey: ["match-details", id], queryFn: () => fetchMatchDetails(String(id)), enabled: Boolean(id), refetchInterval: (query) => query.state.data?.match.status === "Live" ? 30_000 : false });
  const details = detailsQuery.data;
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 14), paddingBottom: 50 }}>
    <View style={styles.nav}><Pressable onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={21} color={colors.foreground} /></Pressable><Text style={[styles.navTitle, { color: colors.foreground }]}>Match center</Text><View style={{ width: 21 }} /></View>
    {detailsQuery.isLoading ? <DetailSkeleton colors={colors} /> : detailsQuery.isError || !details ? <View style={styles.errorBox}><Text style={[styles.message, { color: colors.mutedForeground }]}>Couldn't load match details.</Text><Pressable onPress={() => detailsQuery.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View> : <DetailContent details={details} tab={tab} setTab={setTab} colors={colors} />}
  </ScrollView>;
}

function DetailContent({ details, tab, setTab, colors }: { details: Awaited<ReturnType<typeof fetchMatchDetails>>; tab: Tab; setTab: (tab: Tab) => void; colors: ReturnType<typeof useColors> }) {
  const match = details.match;
  const tabs: Tab[] = ["Overview", "Performance", "Economy", ...(details.capabilities.headToHead ? ["H2H" as const] : [])];
  return <>
    <Text style={[styles.competition, { color: colors.foreground }]}>{match.tournament}</Text>
    <Text style={[styles.series, { color: colors.mutedForeground }]}>{match.game} · {match.format}</Text>
    <View style={styles.teams}>
      <TeamColumn team={match.teamA} colors={colors} />
      <View style={styles.scoreBlock}><Text style={[styles.status, { color: match.status === "Live" ? colors.primary : colors.mutedForeground }]}>{match.status === "Live" ? "LIVE" : match.status === "Finished" ? "FINAL" : match.time}</Text><Text style={[styles.score, { color: colors.foreground }]}>{match.scoreA ?? "—"} <Text style={{ color: colors.mutedForeground }}>–</Text> {match.scoreB ?? "—"}</Text><Text style={[styles.format, { color: colors.mutedForeground }]}>{match.format}</Text></View>
      <TeamColumn team={match.teamB} colors={colors} />
    </View>
    <Text style={[styles.date, { color: colors.mutedForeground }]}>{match.startTime ? new Date(match.startTime).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : "Date unavailable"}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && { borderBottomColor: colors.primary }]}><Text style={[styles.tabText, { color: tab === item ? colors.primary : colors.mutedForeground }]}>{item}</Text></Pressable>)}</ScrollView>
    <MapSelector details={details} colors={colors} />
    {tab === "Overview" ? <Overview details={details} colors={colors} /> : tab === "Performance" ? <Performance details={details} colors={colors} /> : tab === "Economy" ? <Economy details={details} colors={colors} /> : <H2H details={details} colors={colors} />}
  </>;
}

function MapSelector({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.mapArea}>
    <Text style={[styles.mapLabel, { color: colors.mutedForeground }]}>MAPS</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mapTabs}>
      <View style={[styles.mapTab, styles.mapTabSelected, { backgroundColor: colors.secondary, borderColor: colors.primary }]}><Text style={[styles.mapTabText, { color: colors.foreground }]}>All Maps</Text></View>
      {details.maps.map((map) => <View key={map.id} style={[styles.mapTab, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.mapTabText, { color: colors.mutedForeground }]}>{map.mapNumber} {map.mapName ?? "Map"}</Text></View>)}
      {!details.capabilities.maps && <View style={[styles.mapUnavailable, { borderColor: colors.border }]}><Text style={[styles.mapUnavailableText, { color: colors.mutedForeground }]}>Map data unavailable</Text></View>}
    </ScrollView>
  </View>;
}

function Overview({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  const match = details.match;
  return <View>
    <SectionTitle title="SERIES SUMMARY" colors={colors} />
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <InfoRow label="Competition" value={match.tournament} colors={colors} />
      <InfoRow label="Format" value={match.format} colors={colors} />
      <InfoRow label="Streams" value={match.streams?.length ? `${match.streams.length} available` : "Data unavailable"} colors={colors} />
      <InfoRow label="Maps" value={details.capabilities.maps ? `${details.maps.length} available` : "Data unavailable"} colors={colors} />
    </View>
    <SectionTitle title="MAPS" colors={colors} />
    <Unavailable text="Map names and map scores are not available from the current PandaScore match feed." colors={colors} />
    <SectionTitle title="PLAYER PERFORMANCE" colors={colors} />
    <Unavailable text="Player K/D/A, ACS, ADR, KAST, HS%, first kills and agents are not available from the current feed." colors={colors} />
    <SectionTitle title="ECONOMY" colors={colors} />
    <Unavailable text="Economy and attack/defense splits are not available from the current feed." colors={colors} />
    <RecentMatches details={details} colors={colors} />
  </View>;
}

function Performance({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  return <View><SectionTitle title="PERFORMANCE" colors={colors} /><Unavailable text="Player performance and team comparison are not available from the current PandaScore feed." colors={colors} /></View>;
}

function Economy({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  return <View><SectionTitle title="ECONOMY" colors={colors} /><Unavailable text="Economy, pistol rounds and attack/defense splits are not available from the current PandaScore feed." colors={colors} /></View>;
}

function H2H({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  return <View><SectionTitle title="HEAD-TO-HEAD" colors={colors} />{details.headToHead.length === 0 ? <Unavailable text="No previous head-to-head matches found." colors={colors} /> : details.headToHead.slice(0, 5).map((match) => <PastMatch key={match.id} match={match} colors={colors} />)}</View>;
}

function RecentMatches({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  return <>{details.recentMatches.map((group) => <View key={group.teamId}><SectionTitle title={`RECENT MATCHES · ${group.matches[0]?.teamA.id === group.teamId ? group.matches[0].teamA.name : group.matches[0]?.teamB.name ?? "TEAM"}`} colors={colors} />{group.matches.length === 0 ? <Unavailable text="No recent matches found." colors={colors} /> : group.matches.map((match) => <PastMatch key={match.id} match={match} colors={colors} focusTeamId={group.teamId} />)}</View>)}</>;
}

function PastMatch({ match, colors, focusTeamId }: { match: Match; colors: ReturnType<typeof useColors>; focusTeamId?: string }) {
  const focusedHome = focusTeamId ? match.teamA.id === focusTeamId : false;
  const won = focusTeamId ? (focusedHome ? (match.scoreA ?? -1) > (match.scoreB ?? -1) : (match.scoreB ?? -1) > (match.scoreA ?? -1)) : undefined;
  return <View style={[styles.pastMatch, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.resultMark, { color: won === undefined ? colors.mutedForeground : won ? colors.positive : colors.destructive }]}>{won === undefined ? "—" : won ? "W" : "L"}</Text><Text style={[styles.pastScore, { color: colors.foreground }]}>{match.scoreA ?? "—"} – {match.scoreB ?? "—"}</Text><Text style={[styles.pastTeams, { color: colors.foreground }]} numberOfLines={1}>{match.teamA.name} vs {match.teamB.name}</Text><Text style={[styles.pastDate, { color: colors.mutedForeground }]}>{match.startTime ? new Date(match.startTime).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}</Text></View>;
}

function TeamColumn({ team, colors }: { team: Match["teamA"]; colors: ReturnType<typeof useColors> }) { return <View style={styles.teamColumn}><TeamBadge {...team} /><Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>{team.name}</Text></View>; }
function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) { return <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>; }
function InfoRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.infoRow, { borderBottomColor: colors.border }]}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text></View>; }
function Unavailable({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.unavailable, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.unavailableTitle, { color: colors.mutedForeground }]}>Data unavailable</Text><Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>{text}</Text></View>; }
function DetailSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) { return <View><View style={[styles.skeleton, { backgroundColor: colors.card }]} /><View style={[styles.skeletonWide, { backgroundColor: colors.card }]} /><View style={[styles.skeleton, { backgroundColor: colors.card }]} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }, navTitle: { fontSize: 14, fontWeight: "600" },
  competition: { fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 }, series: { fontSize: 12, textAlign: "center", marginTop: 5 }, teams: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24 }, teamColumn: { alignItems: "center", width: "29%", gap: 9 }, teamName: { fontSize: 14, fontWeight: "700", textAlign: "center" }, scoreBlock: { alignItems: "center" }, status: { fontSize: 11, fontWeight: "800", letterSpacing: 1 }, score: { fontSize: 27, fontWeight: "800", fontVariant: ["tabular-nums"], marginTop: 4 }, format: { fontSize: 11, fontWeight: "700", marginTop: 4 }, date: { fontSize: 12, textAlign: "center", marginTop: 18 }, tabs: { flexDirection: "row", marginTop: 25 }, tab: { paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 2, borderBottomColor: "transparent" }, tabText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }, mapArea: { marginTop: 14 }, mapLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 8 }, mapTabs: { gap: 8, paddingBottom: 2 }, mapTab: { minWidth: 94, minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" }, mapTabSelected: { borderWidth: 1.5 }, mapTabText: { fontSize: 11, fontWeight: "700" }, mapUnavailable: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center" }, mapUnavailableText: { fontSize: 11 }, sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 24, marginBottom: 10 }, panel: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 }, infoRow: { minHeight: 44, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, infoRowLast: { borderBottomWidth: 0 }, infoLabel: { fontSize: 12 }, infoValue: { fontSize: 12, fontWeight: "700", maxWidth: "60%", textAlign: "right" }, unavailable: { borderWidth: 1, borderRadius: 12, padding: 15 }, unavailableTitle: { fontSize: 12, fontWeight: "800" }, unavailableText: { fontSize: 12, lineHeight: 18, marginTop: 5 }, pastMatch: { minHeight: 52, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, marginBottom: 7, flexDirection: "row", alignItems: "center", gap: 8 }, resultMark: { width: 18, fontSize: 11, fontWeight: "900" }, pastScore: { width: 38, fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] }, pastTeams: { flex: 1, fontSize: 12, fontWeight: "600" }, pastDate: { fontSize: 10 }, message: { fontSize: 14, textAlign: "center", marginTop: 40 }, errorBox: { alignItems: "center" }, retry: { fontSize: 13, fontWeight: "600", marginTop: 10 }, skeleton: { height: 145, borderRadius: 12, marginBottom: 14 }, skeletonWide: { height: 52, borderRadius: 12, marginBottom: 14 },
});