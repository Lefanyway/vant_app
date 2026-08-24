import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { TeamLink } from "@/components/TeamLink";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchTeamMatches, fetchTeamNews, fetchTeamOverview, fetchTeamRoster, fetchTeamStats, toApiTeam, toMatch, type ApiPlayer, type TeamNewsArticle } from "@/lib/api";
import type { Match, Team } from "@/lib/data";

type Tab = "Overview" | "Matches" | "Roster" | "Stats";

export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Overview");
  const teamId = String(id ?? "");
  const overview = useQuery({ queryKey: ["team-overview", teamId], queryFn: () => fetchTeamOverview(teamId), enabled: Boolean(teamId), staleTime: 6 * 60 * 60_000 });
  const data = overview.data;
  const team = data?.team;
  const tabs: Tab[] = data ? ["Overview", "Matches", ...(data.capabilities.roster ? ["Roster" as const] : []), ...(data.capabilities.stats ? ["Stats" as const] : [])] : ["Overview", "Matches"];
  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 46 }}>
      <View style={styles.nav}><Pressable onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={21} color={colors.foreground} /></Pressable><Text style={[styles.navTitle, { color: colors.foreground }]}>Team profile</Text><View style={{ width: 21 }} /></View>
      {overview.isLoading ? <TeamSkeleton colors={colors} /> : overview.isError || !team ? <View style={styles.center}><Text style={[styles.message, { color: colors.mutedForeground }]}>{overview.isError ? "Couldn't load team." : "Team not found."}</Text><Pressable onPress={() => overview.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View> : <>
        <TeamHeader team={team} colors={colors} />
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && { borderBottomColor: colors.primary }]}><Text style={[styles.tabText, { color: tab === item ? colors.primary : colors.mutedForeground }]}>{item}</Text></Pressable>)}</View>
        {tab === "Overview" ? <Overview data={data} colors={colors} onRosterPress={() => setTab("Roster")} /> : tab === "Matches" ? <MatchesTab teamId={teamId} team={toApiTeam(team)} colors={colors} /> : tab === "Roster" ? <RosterTab teamId={teamId} preview={data.rosterPreview} colors={colors} /> : <StatsTab teamId={teamId} colors={colors} />}
      </>}
    </ScrollView>
  );
}

function TeamHeader({ team, colors }: { team: NonNullable<Awaited<ReturnType<typeof fetchTeamOverview>>>["team"]; colors: ReturnType<typeof useColors> }) {
  const { favoriteTeams, toggleFavorite } = useApp();
  const followed = favoriteTeams.includes(team.id);
  return <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.identity}><View style={[styles.logoFrame, { backgroundColor: colors.background, borderColor: colors.border }]}><ResolvedLogo type="team" name={team.name} game={team.gameId} logoUrl={team.logoUrl} size={68} /></View><View style={styles.copy}><Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>{team.acronym ? <Text style={[styles.acronym, { color: colors.mutedForeground }]}>{team.acronym}</Text> : null}<Text style={[styles.meta, { color: colors.mutedForeground }]}>{team.gameId === "cs2" ? "CS2" : team.gameId === "lol" ? "League of Legends" : "Valorant"}{team.country ? ` · ${team.country}` : ""}</Text></View></View>
    <Pressable accessibilityRole="button" onPress={() => toggleFavorite(team.id)} style={[styles.follow, { borderColor: followed ? colors.primary : colors.border, backgroundColor: followed ? colors.accent : colors.secondary }]}><Feather name={followed ? "check" : "plus"} size={14} color={followed ? colors.primary : colors.foreground} /><Text style={[styles.followText, { color: followed ? colors.primary : colors.foreground }]}>{followed ? "Following" : "Follow"}</Text></Pressable>
  </View>;
}

function Overview({ data, colors, onRosterPress }: { data: NonNullable<Awaited<ReturnType<typeof fetchTeamOverview>>>; colors: ReturnType<typeof useColors>; onRosterPress: () => void }) {
  const team = toApiTeam(data.team);
  const news = useQuery({ queryKey: ["team-news", data.team.id], queryFn: () => fetchTeamNews(data.team.id), enabled: data.capabilities.news, staleTime: 15 * 60_000 });
  return <View>
    <Section title="NEXT MATCH" colors={colors} />
    {data.nextMatch ? <MatchRow match={toMatch(data.nextMatch)} focusTeam={team} colors={colors} /> : <Empty text="No upcoming matches." colors={colors} />}
    <Section title="RECENT FORM" colors={colors} />
    <View style={styles.form}>{data.recentForm.length ? data.recentForm.map((item, index) => <View key={`${item}-${index}`} style={[styles.formDot, { backgroundColor: item === "W" ? colors.positive : item === "L" ? colors.destructive : colors.secondary }]}><Text style={[styles.formText, { color: item === "D" ? colors.mutedForeground : colors.background }]}>{item}</Text></View>) : <Text style={[styles.muted, { color: colors.mutedForeground }]}>No completed matches.</Text>}</View>
    <Section title="RECENT RESULTS" colors={colors} />
    {data.recentMatches.length ? data.recentMatches.map((match) => <MatchRow key={match.id} match={toMatch(match)} focusTeam={team} colors={colors} />) : <Empty text="No matches found." colors={colors} />}
    <Section title="COMPETITIONS" colors={colors} />
    {data.competitions.length ? <View>{data.competitions.map((competition) => <View key={competition.id} style={[styles.competition, { backgroundColor: colors.card, borderColor: colors.border }]}><ResolvedLogo type="competition" name={competition.name} logoUrl={competition.logoUrl} size={30} /><View><Text style={[styles.competitionName, { color: colors.foreground }]}>{competition.name}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{competition.region ?? competition.serieName ?? "Competition"}</Text></View></View>)}</View> : <Empty text="No current competitions found." colors={colors} />}
    <Section title="ROSTER" colors={colors} />
    {data.rosterPreview.length ? <RosterPreview players={data.rosterPreview} colors={colors} /> : <Empty text="Roster unavailable." colors={colors} />}
    {data.capabilities.roster && data.rosterPreview.length > 0 ? <Pressable onPress={onRosterPress} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>View full roster</Text><Feather name="arrow-right" size={15} color={colors.primary} /></Pressable> : null}
    {news.data?.articles?.length ? <NewsSection articles={news.data.articles} colors={colors} /> : null}
  </View>;
}

function NewsSection({ articles, colors }: { articles: TeamNewsArticle[]; colors: ReturnType<typeof useColors> }) {
  return <View><Section title="NEWS" colors={colors} />{articles.map((article) => <Pressable key={article.id} onPress={() => void Linking.openURL(article.url)} style={[styles.newsItem, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.newsCopy}><Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={2}>{article.title}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{article.source} · {new Date(article.publishedAt).toLocaleDateString()}</Text>{article.summary ? <Text style={[styles.newsSummary, { color: colors.mutedForeground }]} numberOfLines={2}>{article.summary}</Text> : null}</View><Feather name="external-link" size={16} color={colors.mutedForeground} /></Pressable>)}</View>;
}

function MatchesTab({ teamId, team, colors }: { teamId: string; team: Team; colors: ReturnType<typeof useColors> }) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "finished">("all");
  const matches = useInfiniteQuery({ queryKey: ["team-matches", teamId, filter], queryFn: ({ pageParam }) => fetchTeamMatches(teamId, filter, pageParam), initialPageParam: 1, getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined, staleTime: 60 * 60_000 });
  const rows = matches.data?.pages.flatMap((page) => page.matches) ?? [];
  return <View><View style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.border }]}>{(["all", "upcoming", "finished"] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && { backgroundColor: colors.secondary }]}><Text style={[styles.filterText, { color: filter === item ? colors.foreground : colors.mutedForeground }]}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>{matches.isLoading ? <Empty text="Loading matches…" colors={colors} /> : matches.isError ? <Empty text="Couldn't load matches." colors={colors} /> : rows.length ? rows.map((match) => <MatchRow key={match.id} match={toMatch(match)} focusTeam={team} colors={colors} />) : <Empty text="No matches found." colors={colors} />}{matches.hasNextPage ? <Pressable onPress={() => matches.fetchNextPage()} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>{matches.isFetchingNextPage ? "Loading…" : "Load more"}</Text></Pressable> : null}</View>;
}

function RosterTab({ teamId, preview, colors }: { teamId: string; preview: ApiPlayer[]; colors: ReturnType<typeof useColors> }) {
  const roster = useQuery({ queryKey: ["team-roster", teamId], queryFn: () => fetchTeamRoster(teamId), initialData: preview, staleTime: 3 * 60 * 60_000 });
  const players = roster.data ?? [];
  return <View><Section title="PLAYERS" colors={colors} />{players.filter((player) => player.status !== "coach" && player.status !== "staff").map((player) => <PlayerRow key={player.id} player={player} colors={colors} />)}<Section title="COACHING & STAFF" colors={colors} />{players.filter((player) => player.status === "coach" || player.status === "staff").length ? players.filter((player) => player.status === "coach" || player.status === "staff").map((player) => <PlayerRow key={player.id} player={player} colors={colors} />) : <Empty text="Staff unavailable." colors={colors} />}</View>;
}

function StatsTab({ teamId, colors }: { teamId: string; colors: ReturnType<typeof useColors> }) {
  const query = useQuery({ queryKey: ["team-stats", teamId, "30d"], queryFn: () => fetchTeamStats(teamId), staleTime: 6 * 60 * 60_000 });
  const stats = query.data?.stats;
  return <View><Section title="TEAM STATS · LAST 30 DAYS" colors={colors} />{query.isLoading ? <Empty text="Loading stats…" colors={colors} /> : !stats ? <Empty text="Team stats unavailable." colors={colors} /> : <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}><StatCard label="Matches" value={stats.matches} colors={colors} /><StatCard label="Wins" value={stats.wins} colors={colors} /><StatCard label="Losses" value={stats.losses} colors={colors} /><StatCard label="Win rate" value={`${Math.round((stats.wins / stats.matches) * 100)}%`} colors={colors} /></View>}</View>;
}

function MatchRow({ match, focusTeam, colors }: { match: Match; focusTeam: Team; colors: ReturnType<typeof useColors> }) {
  const opponent = match.teamA.id === focusTeam.id ? match.teamB : match.teamA;
  const ownScore = match.teamA.id === focusTeam.id ? match.scoreA : match.scoreB;
  const opponentScore = match.teamA.id === focusTeam.id ? match.scoreB : match.scoreA;
  const result = ownScore === undefined || opponentScore === undefined ? "—" : ownScore > opponentScore ? "W" : ownScore < opponentScore ? "L" : "D";
  return <Pressable onPress={() => router.push(`/match/${match.id}`)} style={[styles.matchRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.matchMain}><Text style={[styles.matchCompetition, { color: colors.mutedForeground }]} numberOfLines={1}>{match.tournament}</Text><Text style={[styles.matchDate, { color: colors.mutedForeground }]}>{match.status === "Finished" ? new Date(match.startTime ?? "").toLocaleDateString([], { month: "short", day: "numeric" }) : match.time}</Text></View><View style={styles.opponent}><TeamLink team={opponent} compact><ResolvedLogo type="team" name={opponent.name} game={opponent.game} logoUrl={opponent.logoUrl} size={26} /><Text style={[styles.opponentName, { color: colors.foreground }]} numberOfLines={1}>{opponent.name}</Text></TeamLink></View><Text style={[styles.matchScore, { color: colors.foreground }]}>{ownScore ?? "—"}–{opponentScore ?? "—"}</Text><Text style={[styles.result, { color: result === "W" ? colors.positive : result === "L" ? colors.destructive : colors.mutedForeground }]}>{result}</Text></Pressable>;
}

function RosterPreview({ players, colors }: { players: ApiPlayer[]; colors: ReturnType<typeof useColors> }) { return <View style={[styles.roster, { backgroundColor: colors.card, borderColor: colors.border }]}>{players.slice(0, 5).map((player) => <View key={player.id} style={styles.rosterItem}><View style={[styles.avatar, { backgroundColor: colors.secondary }]}>{player.imageUrl ? <ResolvedLogo type="team" name={player.name} logoUrl={player.imageUrl} size={30} /> : <Feather name="user" size={16} color={colors.mutedForeground} />}</View><Text style={[styles.playerName, { color: colors.foreground }]}>{player.name}</Text></View>)}</View>; }
function PlayerRow({ player, colors }: { player: ApiPlayer; colors: ReturnType<typeof useColors> }) { return <View style={[styles.playerRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.avatar, { backgroundColor: colors.secondary }]}>{player.imageUrl ? <ResolvedLogo type="team" name={player.name} logoUrl={player.imageUrl} size={38} /> : <Feather name="user" size={18} color={colors.mutedForeground} />}</View><View style={{ flex: 1 }}><Text style={[styles.playerName, { color: colors.foreground }]}>{player.name}</Text>{player.fullName && player.fullName !== player.name ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{player.fullName}</Text> : null}</View>{player.country ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{player.country}</Text> : null}</View>; }
function Section({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) { return <Text style={[styles.section, { color: colors.mutedForeground }]}>{title}</Text>; }
function Empty({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.muted, { color: colors.mutedForeground }]}>{text}</Text></View>; }
function StatCard({ label, value, colors }: { label: string; value: string | number; colors: ReturnType<typeof useColors> }) { return <View style={styles.statCard}><Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{label}</Text></View>; }
function TeamSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) { return <View><View style={[styles.skeleton, { backgroundColor: colors.card }]} /><View style={[styles.skeletonWide, { backgroundColor: colors.card }]} /><View style={[styles.skeletonWide, { backgroundColor: colors.card }]} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, navTitle: { fontSize: 14, fontWeight: "700" }, header: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 }, identity: { flexDirection: "row", alignItems: "center", gap: 14 }, logoFrame: { width: 86, height: 86, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" }, copy: { flex: 1 }, teamName: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6 }, acronym: { fontSize: 12, fontWeight: "700", marginTop: 2 }, meta: { fontSize: 13, marginTop: 8 }, follow: { alignSelf: "flex-start", minHeight: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7 }, followText: { fontSize: 12, fontWeight: "800" }, tabs: { flexDirection: "row", borderBottomWidth: 1, marginTop: 18 }, tab: { paddingVertical: 13, paddingHorizontal: 13, borderBottomWidth: 2, borderBottomColor: "transparent" }, tabText: { fontSize: 11, fontWeight: "800" }, section: { fontSize: 10, fontWeight: "800", letterSpacing: 1.15, marginTop: 24, marginBottom: 9 }, matchRow: { minHeight: 68, borderWidth: 1, borderRadius: 11, padding: 11, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 }, matchMain: { flex: 1 }, matchCompetition: { fontSize: 11, fontWeight: "700" }, matchDate: { fontSize: 10, marginTop: 5 }, opponent: { maxWidth: 105 }, opponentName: { fontSize: 11, fontWeight: "700", marginLeft: 6 }, matchScore: { width: 40, textAlign: "center", fontSize: 13, fontWeight: "800" }, result: { width: 16, textAlign: "right", fontSize: 12, fontWeight: "900" }, form: { flexDirection: "row", gap: 8 }, formDot: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" }, formText: { fontSize: 11, fontWeight: "900" }, muted: { fontSize: 11 }, competition: { minHeight: 58, borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 7 }, competitionName: { fontSize: 13, fontWeight: "700", marginBottom: 3 }, roster: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 }, rosterItem: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" }, playerName: { fontSize: 13, fontWeight: "700" }, moreButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, marginTop: 10, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, moreText: { fontSize: 12, fontWeight: "800" }, newsItem: { minHeight: 76, borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }, newsCopy: { flex: 1, gap: 5 }, newsTitle: { fontSize: 13, fontWeight: "700" }, newsSummary: { fontSize: 11, lineHeight: 16 }, filterBar: { borderWidth: 1, borderRadius: 10, padding: 3, marginTop: 18, flexDirection: "row" }, filter: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 7 }, filterText: { fontSize: 11, fontWeight: "800" }, playerRow: { minHeight: 62, borderWidth: 1, borderRadius: 11, padding: 11, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }, statsGrid: { borderWidth: 1, borderRadius: 12, padding: 8, flexDirection: "row", flexWrap: "wrap" }, statCard: { width: "50%", minHeight: 78, padding: 10, justifyContent: "center" }, statValue: { fontSize: 22, fontWeight: "800", marginBottom: 4 }, empty: { minHeight: 58, borderWidth: 1, borderRadius: 11, padding: 16, alignItems: "center", justifyContent: "center" }, center: { alignItems: "center", paddingTop: 50 }, message: { fontSize: 14 }, retry: { fontSize: 13, fontWeight: "700", marginTop: 10 }, skeleton: { height: 125, borderRadius: 16, marginBottom: 14 }, skeletonWide: { height: 62, borderRadius: 12, marginBottom: 10 },
});