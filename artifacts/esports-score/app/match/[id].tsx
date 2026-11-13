import { ResolvedLogo } from "@/components/ResolvedLogo";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Pulse } from "@/components/MobileChrome";
import { ApiError, applyMatchStats, errorMessage, fetchMatch, fetchMatchDetails, fetchMatchStats, type MatchDetails } from "@/lib/api";
import type { Match } from "@/lib/data";
import { hasScore } from "@/lib/matches";
import { goBackOrHome, openCompetition, openMatch } from "@/lib/navigation";
import { TeamBadge } from "@/components/MatchCard";
import { useColors } from "@/hooks/useColors";
import { TeamLink } from "@/components/TeamLink";
import { useActiveScreen } from "@/hooks/useActiveScreen";
import { WinProbability } from "@/components/WinProbability";
import { ResultList } from "@/components/ResultRow";
import { RecentByTeam } from "@/components/RecentByTeam";
import { ShareButton } from "@/components/ShareButton";
import { WatchOptions } from "@/components/WatchOptions";

type Tab = "Overview" | "Performance" | "Economy" | "H2H";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const active = useActiveScreen();
  const [tab, setTab] = useState<Tab>("Overview");
  const previewQuery = useQuery({ queryKey: ["match-preview", id], queryFn: () => fetchMatch(String(id)), enabled: Boolean(id), staleTime: 60_000 });
  const detailsQuery = useQuery({ queryKey: ["match-details", id], queryFn: ({ signal }) => fetchMatchDetails(String(id), signal), enabled: Boolean(id), staleTime: 60_000, refetchInterval: (query) => active && query.state.data?.match.status === "Live" ? 45_000 : false });
  const statsQuery = useQuery({ queryKey: ["match-stats", id], queryFn: ({ signal }) => fetchMatchStats(String(id), signal), enabled: Boolean(id), staleTime: 60_000 });
  const knownMatch = detailsQuery.data?.match ?? previewQuery.data;
  const details = detailsQuery.data ? applyMatchStats(detailsQuery.data, statsQuery.data) : null;
  // A missing match gets a way back instead of a retry that would fail again.
  const notFound = [previewQuery.error, detailsQuery.error].some(error => error instanceof ApiError && error.status === 404) || (!previewQuery.isError && !detailsQuery.isError);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.nav, { paddingTop: Math.max(insets.top, 8), paddingHorizontal: 8 }]}><BackButton /></View>
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 50 }}>
    {knownMatch ? <DetailContent match={knownMatch} details={details} detailsLoading={detailsQuery.isLoading} updatedAt={detailsQuery.dataUpdatedAt} detailsError={detailsQuery.isError ? errorMessage(detailsQuery.error, "Não foi possível carregar o restante da partida.") : null} onRetry={() => { void detailsQuery.refetch(); void statsQuery.refetch(); }} tab={tab} setTab={setTab} colors={colors} /> : previewQuery.isLoading || detailsQuery.isLoading ? <DetailSkeleton colors={colors} /> : notFound ? <View style={styles.errorBox}><Text style={[styles.message, { color: colors.mutedForeground }]}>Partida não encontrada.</Text><Pressable onPress={goBackOrHome}><Text style={[styles.retry, { color: colors.primary }]}>Voltar</Text></Pressable></View> : <View style={styles.errorBox}><Text style={[styles.message, { color: colors.mutedForeground }]}>{errorMessage(detailsQuery.error ?? previewQuery.error, "Não foi possível carregar a partida.")}</Text><Pressable onPress={() => { void previewQuery.refetch(); void detailsQuery.refetch(); }}><Text style={[styles.retry, { color: colors.primary }]}>Tentar novamente</Text></Pressable></View>}
  </ScrollView>
  </View>;
}

function DetailContent({ match, details, detailsLoading, updatedAt, detailsError, onRetry, tab, setTab, colors }: { match: Match; details: MatchDetails | null; detailsLoading: boolean; updatedAt: number; detailsError: string | null; onRetry: () => void; tab: Tab; setTab: (tab: Tab) => void; colors: ReturnType<typeof useColors> }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "Overview", label: "Detalhes" },
    ...((details?.stats?.playerStats.length ?? 0) > 0 ? [{ key: "Performance" as const, label: "Jogadores" }] : []),
    ...(details?.stats?.economy ? [{ key: "Economy" as const, label: "Economia" }] : []),
    ...((details?.headToHead.length ?? 0) > 0 ? [{ key: "H2H" as const, label: "Confrontos" }] : []),
  ];
  return <>
    <View style={[styles.hero, { backgroundColor: colors.card }]}>
      <View style={styles.heroActions}><ShareButton label="Compartilhar partida" message={`${match.teamA.name} vs ${match.teamB.name} · ${match.tournament} · ${match.time}`} /></View>
      <View style={styles.teams}>
        <TeamColumn team={match.teamA} colors={colors} />
        <View style={styles.scoreBlock}>
          {hasScore(match) ? <Text style={[styles.score, { color: colors.foreground }]}>{match.scoreA} – {match.scoreB}</Text> : <Text style={[styles.score, { color: colors.foreground }]}>{match.time}</Text>}
          <Text style={[styles.status, { color: match.status === "Live" ? colors.destructive : colors.mutedForeground }]}>{match.status === "Live" ? "● Ao vivo" : match.status === "Finished" ? "Finalizada" : match.status === "Cancelled" ? "Cancelada" : match.status === "Postponed" ? "Adiada" : match.startTime ? new Date(match.startTime).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "A definir"}</Text>
          {match.format ? <Text style={[styles.format, { color: colors.mutedForeground }]}>{match.format}</Text> : null}
        </View>
        <TeamColumn team={match.teamB} colors={colors} />
      </View>
      {details && updatedAt ? <Text style={[styles.updated, { color: colors.mutedForeground }]}>Atualizado às {new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text> : null}
    </View>
    {tabs.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} onPress={() => setTab(item.key)} style={[styles.tab, { borderBottomColor: tab === item.key ? colors.foreground : "transparent" }]}><Text style={[styles.tabText, { color: tab === item.key ? colors.foreground : colors.mutedForeground }]}>{item.label}</Text></Pressable>)}</ScrollView> : null}
    <Pressable disabled={!match.competitionId || match.competitionId.startsWith("unknown:")} onPress={() => match.competitionId && openCompetition(match.competitionId)} style={[styles.competitionRow, { backgroundColor: colors.card }]}>
      <ResolvedLogo type="competition" name={match.tournament} entityId={match.competitionId} logoUrl={match.competitionLogoUrl} size={34} />
      <Text style={[styles.competitionCopy, { color: colors.foreground }]}>{match.tournament}<Text style={{ color: colors.mutedForeground }}>{"\n"}{[match.format, match.startTime ? new Date(match.startTime).toLocaleString("pt-BR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Data a definir"].filter(Boolean).join(" · ")}</Text></Text>
      <Feather name="chevron-right" size={22} color={colors.primary} />
    </Pressable>
    {details ? <>{tab === "Overview" ? <Overview details={details} colors={colors} /> : tab === "Performance" ? <Performance details={details} colors={colors} /> : tab === "Economy" ? <Economy details={details} colors={colors} /> : <H2H details={details} colors={colors} />}</> : detailsLoading ? <DetailSkeleton colors={colors} /> : <View style={styles.errorBox}><Text style={[styles.message, { color: colors.mutedForeground }]}>{detailsError ?? "Não foi possível carregar os detalhes."}</Text><Pressable onPress={onRetry}><Text style={[styles.retry, { color: colors.primary }]}>Tentar novamente</Text></Pressable></View>}
  </>;
}
function Overview({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  const match = details.match;
  return <View>
    {match.streams?.length && match.status !== "Finished" && match.status !== "Cancelled" ? <WatchOptions streams={match.streams} /> : null}
    <WinProbability match={match} />
    {details.maps.some(map => map.mapName) ? <SectionTitle title="Mapas" colors={colors} /> : null}
    {!details.maps.some(map => map.mapName) ? null : <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>{details.maps.filter((map) => map.mapName).map((map, index, named) => <InfoRow key={map.id} last={index === named.length - 1} label={map.mapName ?? `Mapa ${map.mapNumber}`} value={typeof map.homeScore === "number" && typeof map.awayScore === "number" ? `${map.homeScore}–${map.awayScore}` : "A definir"} colors={colors} />)}</View>}
    <RecentMatches details={details} colors={colors} />
  </View>;
}

function Performance({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  const players = details.stats?.playerStats ?? [];
  return <View><SectionTitle title="Jogadores" colors={colors} />{players.length === 0 ? <Unavailable text="As estatísticas dos jogadores ainda não estão disponíveis para esta partida." colors={colors} /> : <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>{players.map((player) => <View key={player.playerId} style={[styles.playerRow, { borderBottomColor: colors.border }]}><View style={styles.playerIdentity}><Text style={[styles.playerName, { color: colors.foreground }]}>{player.playerName}</Text>{player.agent ? <Text style={[styles.playerAgent, { color: colors.mutedForeground }]}>{player.agent}</Text> : null}</View><Stat label="RATING" value={player.rating} colors={colors} /><Stat label="KDA" value={player.kills !== undefined || player.deaths !== undefined || player.assists !== undefined ? `${player.kills ?? "—"}/${player.deaths ?? "—"}/${player.assists ?? "—"}` : undefined} colors={colors} /><Stat label="ACS" value={player.acs} colors={colors} /></View>)}</View>}</View>;
}

function Economy({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  const economy = details.stats?.economy;
  return <View><SectionTitle title="Economia" colors={colors} />{!economy ? <Unavailable text="Os dados de economia ainda não estão disponíveis para esta partida." colors={colors} /> : <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}><InfoRow label="Rounds vencidos" value={`${economy.homeRoundsWon ?? "—"} – ${economy.awayRoundsWon ?? "—"}`} colors={colors} /><InfoRow label="Rounds de pistol" value={`${economy.homePistolRoundsWon ?? "—"} – ${economy.awayPistolRoundsWon ?? "—"}`} colors={colors} /><InfoRow label="Rounds no ataque" value={`${economy.homeAttackRoundsWon ?? "—"} – ${economy.awayAttackRoundsWon ?? "—"}`} colors={colors} /><InfoRow label="Rounds na defesa" value={`${economy.homeDefenseRoundsWon ?? "—"} – ${economy.awayDefenseRoundsWon ?? "—"}`} colors={colors} last /></View>}</View>;
}

function H2H({ details, colors }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  return <View><SectionTitle title="Confrontos anteriores" colors={colors} />{details.headToHead.length === 0 ? <Unavailable text="Ainda não há confrontos anteriores disponíveis." colors={colors} /> : <ResultList matches={details.headToHead.slice(0, 5)} />}</View>;
}

function RecentMatches({ details }: { details: MatchDetails; colors: ReturnType<typeof useColors> }) {
  const matchesByTeam = Object.fromEntries(details.recentMatches.map((group) => [group.teamId, group.matches]));
  return <RecentByTeam teams={[details.match.teamA, details.match.teamB]} matchesByTeam={matchesByTeam} />;
}

function TeamColumn({ team, colors }: { team: Match["teamA"]; colors: ReturnType<typeof useColors> }) { return <TeamLink team={team} fill><View style={styles.teamColumn}><TeamBadge {...team} size={62} /><Text numberOfLines={2} style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text></View></TeamLink>; }
function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) { return <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>; }
function InfoRow({ label, value, colors, last = false }: { label: string; value: string; colors: ReturnType<typeof useColors>; last?: boolean }) { return <View style={[styles.infoRow, last && styles.infoRowLast, { borderBottomColor: colors.border }]}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text></View>; }
function Stat({ label, value, colors }: { label: string; value?: number | string; colors: ReturnType<typeof useColors> }) { return <View style={styles.stat}><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{value ?? "—"}</Text></View>; }
function Unavailable({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.unavailable, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.unavailableTitle, { color: colors.mutedForeground }]}>Dados indisponíveis</Text><Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>{text}</Text></View>; }
function DetailSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <Pulse label="Carregando partida"><View style={[styles.skeleton, { backgroundColor: colors.card }]} /><View style={[styles.skeletonWide, { backgroundColor: colors.card }]} /><View style={[styles.skeleton, { backgroundColor: colors.card }]} /></Pulse>;
}

const styles = StyleSheet.create({
 hero: { marginHorizontal: -8, paddingHorizontal: 20, paddingBottom: 22 }, heroActions: { flexDirection: "row", justifyContent: "flex-end", gap: 6 }, heroIcon: { width: 44, height: 44, justifyContent: "center", alignItems: "center" }, competitionRow: { borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, marginTop: 10 }, competitionCopy: { flex: 1, fontSize: 13, lineHeight: 20 },
  screen: { flex: 1, paddingHorizontal: 8 }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }, navTitle: { fontSize: 14, fontWeight: "600" },
  competition: { fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 }, series: { fontSize: 12, textAlign: "center", marginTop: 5 }, teams: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10, gap: 8 }, teamColumn: { alignItems: "center", flex: 1, minWidth: 0, gap: 9 }, teamName: { fontSize: 14, fontWeight: "700", textAlign: "center" }, scoreBlock: { alignItems: "center", minWidth: 88, flexShrink: 0 }, status: { fontSize: 11, fontWeight: "800", letterSpacing: 1 }, score: { fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"], marginTop: 4 }, format: { fontSize: 11, fontWeight: "700", marginTop: 4 }, updated: { fontSize: 11, textAlign: "center", marginTop: 14 }, date: { fontSize: 12, textAlign: "center", marginTop: 18 }, tabs: { flexDirection: "row", marginTop: 0 }, tab: { paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 2, borderBottomColor: "transparent" }, tabText: { fontSize: 14, fontWeight: "600" }, compactNote: { fontSize: 13, lineHeight: 18, marginBottom: 8 }, sectionTitle: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 9 }, panel: { borderWidth: 0, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 6 }, infoRow: { minHeight: 44, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, infoRowLast: { borderBottomWidth: 0 }, infoLabel: { fontSize: 12 }, infoValue: { fontSize: 12, fontWeight: "700", maxWidth: "60%", textAlign: "right" }, playerRow: { minHeight: 62, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 }, playerIdentity: { flex: 1 }, playerName: { fontSize: 12, fontWeight: "700" }, playerAgent: { fontSize: 10, marginTop: 3 }, stat: { width: 42, alignItems: "flex-end" }, statLabel: { fontSize: 8, fontWeight: "800" }, statValue: { fontSize: 11, fontWeight: "800", marginTop: 3 }, unavailable: { borderWidth: 0, borderRadius: 22, padding: 15 }, unavailableTitle: { fontSize: 12, fontWeight: "800" }, unavailableText: { fontSize: 12, lineHeight: 18, marginTop: 5 }, message: { fontSize: 14, textAlign: "center", marginTop: 40 }, errorBox: { alignItems: "center" }, retry: { fontSize: 13, fontWeight: "600", marginTop: 10 }, skeleton: { height: 145, borderRadius: 12, marginBottom: 14 }, skeletonWide: { height: 52, borderRadius: 12, marginBottom: 14 },
});
