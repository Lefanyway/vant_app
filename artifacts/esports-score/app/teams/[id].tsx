import { Image } from "expo-image";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useSwipeTabs } from "@/components/SwipeTabs";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ListSkeleton, Pulse } from "@/components/MobileChrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { TeamLink } from "@/components/TeamLink";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { ApiError, errorMessage, fetchTeamMatches, fetchTeamNews, fetchTeamOverview, fetchTeamRoster, fetchTeamStats, toApiTeam, toMatch, type ApiPlayer, type TeamNewsArticle } from "@/lib/api";
import { goBackOrHome, openCompetition, openMatch } from "@/lib/navigation";
import type { Match, Team } from "@/lib/data";
import { matchDayLabel } from "@/lib/matches";

type Tab = "Overview" | "Matches" | "Roster" | "Stats";

export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Overview");
  const teamId = String(id ?? "");
  const overview = useQuery({ queryKey: ["team-overview", teamId], queryFn: () => fetchTeamOverview(teamId), enabled: Boolean(teamId), staleTime: 6 * 60 * 60_000 });
  // Started with the overview, not after it renders, so the news does not wait in line.
  const news = useQuery({ queryKey: ["team-news", teamId], queryFn: () => fetchTeamNews(teamId), enabled: Boolean(teamId), staleTime: 15 * 60_000 });
  const data = overview.data;
  const team = data?.team;
  const tabs: Tab[] = data ? ["Overview", "Matches", ...(data.capabilities.roster ? ["Roster" as const] : []), ...(data.capabilities.stats ? ["Stats" as const] : [])] : ["Overview", "Matches"];
  // Swiping sideways on the page moves between the team tabs.
  const swipe = useSwipeTabs(tabs, tab, setTab);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.nav, { paddingTop: Math.max(insets.top, 8), paddingHorizontal: 8 }]}><BackButton /></View>
    <GestureDetector gesture={swipe.gesture}>
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 46 }}>
      {overview.isLoading ? <TeamSkeleton colors={colors} /> : overview.isError || !team ? <View style={styles.center}><Text style={[styles.message, { color: colors.mutedForeground }]}>{overview.isError && !(overview.error instanceof ApiError && overview.error.status === 404) ? errorMessage(overview.error, "Não foi possível carregar a equipe.") : "Equipe não encontrada."}</Text>{overview.error instanceof ApiError && overview.error.status === 404 ? <Pressable accessibilityRole="button" onPress={goBackOrHome}><Text style={[styles.retry, { color: colors.primary }]}>Voltar</Text></Pressable> : <Pressable onPress={() => overview.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Tentar novamente</Text></Pressable>}</View> : <>
        <TeamHeader team={team} colors={colors} />
        <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: colors.border }]}>{tabs.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.tab, tab === item && { borderBottomColor: colors.primary }]}><Text numberOfLines={1} style={[styles.tabText, { color: tab === item ? colors.primary : colors.mutedForeground }]}>{({ Overview: "Visão geral", Matches: "Partidas", Roster: "Elenco", Stats: "Estatísticas" })[item]}</Text></Pressable>)}</View>
        <Animated.View key={tab} entering={swipe.entering}>
        {tab === "Overview" ? <Overview data={data} articles={news.data?.articles ?? []} colors={colors} onRosterPress={() => setTab("Roster")} /> : tab === "Matches" ? <MatchesTab teamId={teamId} team={toApiTeam(team)} colors={colors} /> : tab === "Roster" ? <RosterTab teamId={teamId} preview={data.rosterPreview} colors={colors} /> : <StatsTab teamId={teamId} colors={colors} />}
        </Animated.View>
      </>}
    </ScrollView>
    </GestureDetector>
    </View>
  );
}

function TeamHeader({ team, colors }: { team: NonNullable<Awaited<ReturnType<typeof fetchTeamOverview>>>["team"]; colors: ReturnType<typeof useColors> }) {
  const { favoriteTeams, toggleFavorite } = useApp();
  const followed = favoriteTeams.includes(team.id);
  return <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.identity}><ResolvedLogo type="team" name={team.name} entityId={team.id} game={team.gameId} logoUrl={team.logoUrl} size={86} /><View style={styles.copy}><Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>{team.acronym ? <Text style={[styles.acronym, { color: colors.mutedForeground }]}>{team.acronym}</Text> : null}<Text style={[styles.meta, { color: colors.mutedForeground }]}>{team.gameId === "cs2" ? "CS2" : team.gameId === "lol" ? "League of Legends" : "Valorant"}{team.country ? ` · ${team.country}` : ""}</Text></View></View>
    <Pressable accessibilityRole="button" onPress={() => toggleFavorite(team.id)} style={[styles.follow, { borderColor: followed ? colors.primary : colors.border, backgroundColor: followed ? colors.accent : colors.secondary }]}><Feather name={followed ? "check" : "plus"} size={14} color={followed ? colors.primary : colors.foreground} /><Text style={[styles.followText, { color: followed ? colors.primary : colors.foreground }]}>{followed ? "Seguindo" : "Seguir"}</Text></Pressable>
  </View>;
}

function Overview({ data, articles, colors, onRosterPress }: { data: NonNullable<Awaited<ReturnType<typeof fetchTeamOverview>>>; articles: TeamNewsArticle[]; colors: ReturnType<typeof useColors>; onRosterPress: () => void }) {
  const team = toApiTeam(data.team);
  return <View>
    <Section title="Próxima partida" colors={colors} />
    {data.nextMatch ? <MatchRow match={toMatch(data.nextMatch)} focusTeam={team} colors={colors} /> : <Empty text="Nenhuma partida agendada." colors={colors} />}
    <Section title="Últimos resultados" colors={colors} />
    <View style={styles.form}>{data.recentForm.length ? data.recentForm.map((item, index) => <View key={`${item}-${index}`} style={[styles.formDot, { backgroundColor: item === "W" ? colors.positive : item === "L" ? colors.destructive : colors.secondary }]}><Text style={[styles.formText, { color: item === "D" ? colors.mutedForeground : colors.background }]}>{item === "W" ? "V" : item === "L" ? "D" : "E"}</Text></View>) : <Text style={[styles.muted, { color: colors.mutedForeground }]}>Nenhuma partida finalizada.</Text>}</View>
    <Section title="Partidas recentes" colors={colors} />
    {data.recentMatches.length ? data.recentMatches.map((match) => <MatchRow key={match.id} match={toMatch(match)} focusTeam={team} colors={colors} />) : <Empty text="Nenhuma partida encontrada." colors={colors} />}
    <Section title="Competições" colors={colors} />
    {data.competitions.length ? <View>{data.competitions.map((competition) => {
      const linked = Boolean(competition.id) && !competition.id.startsWith("unknown:");
      const body = <><ResolvedLogo type="competition" name={competition.name} logoUrl={competition.logoUrl} size={30} /><View style={styles.competitionCopy}><Text style={[styles.competitionName, { color: colors.foreground }]}>{competition.name}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{competition.region ?? competition.serieName ?? "Competição"}</Text></View></>;
      return linked ? <Pressable key={competition.id} testID={`competition-link-${competition.id}`} accessibilityRole="link" onPress={() => openCompetition(competition.id)} style={[styles.competition, { backgroundColor: colors.card, borderColor: colors.border }]}>{body}</Pressable> : <View key={competition.id} style={[styles.competition, { backgroundColor: colors.card, borderColor: colors.border }]}>{body}</View>;
    })}</View> : <Empty text="Nenhuma competição informada." colors={colors} />}
    <Section title="Elenco" colors={colors} />
    {data.rosterPreview.length ? <RosterPreview players={data.rosterPreview} colors={colors} /> : <Empty text="Elenco indisponível." colors={colors} />}
    {data.capabilities.roster && data.rosterPreview.length > 0 ? <Pressable onPress={onRosterPress} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>Ver elenco completo</Text><Feather name="arrow-right" size={15} color={colors.primary} /></Pressable> : null}
    {data.capabilities.news && articles.length ? <NewsSection articles={articles} colors={colors} /> : null}
  </View>;
}

// Countries come as ISO codes ("BR"); two regional-indicator letters draw the flag.
const flag = (code: string) => /^[a-z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1a5 + letter.charCodeAt(0))) : code;
const host = (url: string) => /^https?:\/\/([^/?#]+)/i.exec(url)?.[1]?.replace(/^www\./, "") ?? "";

function NewsSection({ articles, colors }: { articles: TeamNewsArticle[]; colors: ReturnType<typeof useColors> }) {
  return <View><Section title="Notícias" colors={colors} /><View style={[styles.newsCard, { backgroundColor: colors.card }]}>{articles.map((article, index) => <Pressable key={article.id} accessibilityRole="link" onPress={() => void Linking.openURL(article.url)} style={[styles.newsItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
    <View style={[styles.newsIcon, { backgroundColor: colors.secondary }]}>{host(article.url) ? <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${host(article.url)}&sz=64` }} style={styles.newsFavicon} contentFit="contain" accessibilityLabel={article.source} /> : <Feather name="file-text" size={18} color={colors.mutedForeground} />}</View>
    <View style={styles.newsCopy}><Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={2}>{article.title}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]} numberOfLines={1}>{article.source} · {new Date(article.publishedAt).toLocaleDateString("pt-BR")}</Text></View>
    <Feather name="external-link" size={17} color={colors.mutedForeground} />
  </Pressable>)}</View></View>;
}

function MatchesTab({ teamId, team, colors }: { teamId: string; team: Team; colors: ReturnType<typeof useColors> }) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "finished">("all");
  const matches = useInfiniteQuery({ queryKey: ["team-matches", teamId, filter], queryFn: ({ pageParam }) => fetchTeamMatches(teamId, filter, pageParam), initialPageParam: 1, getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined, staleTime: 60 * 60_000 });
  const rows = matches.data?.pages.flatMap((page) => page.matches) ?? [];
  return <View><View style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.border }]}>{(["all", "upcoming", "finished"] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && { backgroundColor: colors.secondary }]}><Text style={[styles.filterText, { color: filter === item ? colors.foreground : colors.mutedForeground }]}>{({ all: "Todas", upcoming: "Próximas", finished: "Finalizadas" })[item]}</Text></Pressable>)}</View>{matches.isLoading ? <ListSkeleton count={2} /> : matches.isError ? <View><Empty text={errorMessage(matches.error, "Não foi possível carregar as partidas.")} colors={colors} /><Pressable onPress={() => matches.refetch()} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>Tentar novamente</Text></Pressable></View> : rows.length ? rows.map((match) => <MatchRow key={match.id} match={toMatch(match)} focusTeam={team} colors={colors} />) : <Empty text="Nenhuma partida encontrada." colors={colors} />}{matches.hasNextPage ? <Pressable onPress={() => matches.fetchNextPage()} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>{matches.isFetchingNextPage ? "Carregando…" : "Carregar mais"}</Text></Pressable> : null}</View>;
}

function RosterTab({ teamId, preview, colors }: { teamId: string; preview: ApiPlayer[]; colors: ReturnType<typeof useColors> }) {
  const roster = useQuery({ queryKey: ["team-roster", teamId], queryFn: () => fetchTeamRoster(teamId), initialData: preview, staleTime: 3 * 60 * 60_000 });
  const players = roster.data ?? [];
  if (roster.isError && players.length === 0) return <View><Empty text={errorMessage(roster.error, "Não foi possível carregar o elenco.")} colors={colors} /><Pressable onPress={() => roster.refetch()} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>Tentar novamente</Text></Pressable></View>;
  return <View><Section title="Jogadores" colors={colors} />{players.filter((player) => player.status !== "coach" && player.status !== "staff").length ? players.filter((player) => player.status !== "coach" && player.status !== "staff").map((player) => <PlayerRow key={player.id} player={player} colors={colors} />) : <Empty text="Elenco indisponível." colors={colors} />}<Section title="Comissão técnica" colors={colors} />{players.filter((player) => player.status === "coach" || player.status === "staff").length ? players.filter((player) => player.status === "coach" || player.status === "staff").map((player) => <PlayerRow key={player.id} player={player} colors={colors} />) : <Empty text="Comissão técnica indisponível." colors={colors} />}</View>;
}

function StatsTab({ teamId, colors }: { teamId: string; colors: ReturnType<typeof useColors> }) {
  const query = useQuery({ queryKey: ["team-stats", teamId, "30d"], queryFn: () => fetchTeamStats(teamId), staleTime: 6 * 60 * 60_000 });
  const stats = query.data?.stats;
  return <View><Section title="Últimos 30 dias" colors={colors} />{query.isLoading ? <ListSkeleton count={1} /> : query.isError ? <View><Empty text={errorMessage(query.error, "Estatísticas indisponíveis.")} colors={colors} /><Pressable onPress={() => query.refetch()} style={[styles.moreButton, { borderColor: colors.border }]}><Text style={[styles.moreText, { color: colors.primary }]}>Tentar novamente</Text></Pressable></View> : !stats ? <Empty text="Estatísticas indisponíveis." colors={colors} /> : <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}><StatCard label="Partidas" value={stats.matches} colors={colors} /><StatCard label="Vitórias" value={stats.wins} colors={colors} /><StatCard label="Derrotas" value={stats.losses} colors={colors} /><StatCard label="Aproveitamento" value={stats.matches > 0 ? `${Math.round((stats.wins / stats.matches) * 100)}%` : "—"} colors={colors} />{typeof stats.elo === "number" ? <StatCard label="Elo atual (modelo VANT)" value={stats.elo} colors={colors} /> : null}</View>}</View>;
}

function MatchRow({ match, focusTeam, colors }: { match: Match; focusTeam: Team; colors: ReturnType<typeof useColors> }) {
  const opponent = match.teamA.id === focusTeam.id ? match.teamB : match.teamA;
  const ownScore = match.teamA.id === focusTeam.id ? match.scoreA : match.scoreB;
  const opponentScore = match.teamA.id === focusTeam.id ? match.scoreB : match.scoreA;
  const result = ownScore === undefined || opponentScore === undefined ? "—" : ownScore > opponentScore ? "W" : ownScore < opponentScore ? "L" : "D";
  const finished = match.status === "Finished";
  const when = finished ? (match.startTime ? new Date(match.startTime).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }) : "Data indisponível") : matchDayLabel(match);
  const score = ownScore === undefined || opponentScore === undefined ? "vs" : `${ownScore}–${opponentScore}`;
  const label = result === "W" ? "Vitória" : result === "L" ? "Derrota" : result === "D" ? "Empate" : "Resultado indisponível";
  const tone = result === "W" ? colors.positive : result === "L" ? colors.destructive : colors.mutedForeground;
  return <Pressable onPress={() => openMatch(match.id, match)} style={[styles.matchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.matchCompetition, { color: colors.mutedForeground }]} numberOfLines={1}>{match.tournament}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 52 }}><Text style={[styles.matchDate, { color: colors.mutedForeground, marginTop: 0 }]}>{when}</Text>{finished ? null : <Text style={[styles.matchDate, { color: colors.mutedForeground, marginTop: 2 }]}>{match.time}</Text>}</View>
      <View style={{ flex: 1, minWidth: 0 }}><TeamLink team={opponent} fill><View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}><ResolvedLogo type="team" name={opponent.name} entityId={opponent.id} game={opponent.game} logoUrl={opponent.logoUrl} size={28} /><Text style={{ flex: 1, minWidth: 0, color: colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{opponent.name}</Text></View></TeamLink></View>
      <Text style={[styles.matchScore, { color: score === "vs" ? colors.mutedForeground : colors.foreground }]}>{score}</Text>
      <View accessibilityLabel={label} style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: tone + "20", alignItems: "center", justifyContent: "center" }}><Text style={{ color: tone, fontSize: 12, fontWeight: "700" }}>{result === "W" ? "V" : result === "L" ? "D" : result === "D" ? "E" : "—"}</Text></View>
    </View>
  </Pressable>;
}

function RosterPreview({ players, colors }: { players: ApiPlayer[]; colors: ReturnType<typeof useColors> }) { return <View style={[styles.roster, { backgroundColor: colors.card, borderColor: colors.border }]}>{players.slice(0, 5).map((player) => <View key={player.id} style={styles.rosterItem}><PlayerAvatar name={player.name} imageUrl={player.imageUrl} size={44} /><Text style={[styles.playerName, { color: colors.foreground }]}>{player.name}</Text></View>)}</View>; }
function PlayerRow({ player, colors }: { player: ApiPlayer; colors: ReturnType<typeof useColors> }) { return <View style={[styles.playerRow, { backgroundColor: colors.card, borderColor: colors.border }]}><PlayerAvatar name={player.name} imageUrl={player.imageUrl} size={44} /><View style={{ flex: 1 }}><Text style={[styles.playerName, { color: colors.foreground }]}>{player.name}</Text>{player.fullName && player.fullName !== player.name ? <Text style={[styles.muted, { color: colors.mutedForeground }]}>{player.fullName}</Text> : null}</View>{player.country ? <Text accessibilityLabel={player.country} style={styles.flag}>{flag(player.country)}</Text> : null}</View>; }
function Section({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) { return <Text style={[styles.section, { color: colors.mutedForeground }]}>{title}</Text>; }
function Empty({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.muted, { color: colors.mutedForeground }]}>{text}</Text></View>; }
function StatCard({ label, value, colors }: { label: string; value: string | number; colors: ReturnType<typeof useColors> }) { return <View style={styles.statCard}><Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{label}</Text></View>; }
function TeamSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) { return <Pulse label="Carregando equipe"><View style={[styles.skeleton, { backgroundColor: colors.card }]} /><View style={[styles.skeletonWide, { backgroundColor: colors.card }]} /><View style={[styles.skeletonWide, { backgroundColor: colors.card }]} /></Pulse>; }

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, navTitle: { fontSize: 14, fontWeight: "700" }, header: { borderWidth: 0, borderRadius: 24, padding: 16, gap: 16 }, identity: { flexDirection: "row", alignItems: "center", gap: 14 }, copy: { flex: 1, minWidth: 0 }, teamName: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6 }, acronym: { fontSize: 12, fontWeight: "700", marginTop: 2 }, meta: { fontSize: 13, marginTop: 8 }, follow: { alignSelf: "flex-start", minHeight: 44, borderWidth: 0, borderRadius: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7 }, followText: { fontSize: 12, fontWeight: "800" }, tabs: { flexDirection: "row", borderBottomWidth: 1, marginTop: 18 }, tab: { flexGrow: 1, alignItems: "center", paddingVertical: 13, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: "transparent" }, tabText: { fontSize: 14, fontWeight: "600" }, section: { fontSize: 15, fontWeight: "600", letterSpacing: 0, marginTop: 24, marginBottom: 9 }, matchRow: { minHeight: 82, borderWidth: 1, borderRadius: 11, padding: 12, gap: 10, marginBottom: 8 }, matchMain: { flex: 1, minWidth: 0 }, matchCompetition: { fontSize: 11, fontWeight: "700" }, matchDate: { fontSize: 10, marginTop: 5 }, opponent: { maxWidth: 105 }, opponentName: { fontSize: 11, fontWeight: "700", marginLeft: 6 }, matchScore: { width: 40, textAlign: "center", fontSize: 13, fontWeight: "800" }, result: { width: 16, textAlign: "right", fontSize: 12, fontWeight: "900" }, form: { flexDirection: "row", gap: 8 }, formDot: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" }, formText: { fontSize: 11, fontWeight: "900" }, muted: { fontSize: 11 }, competition: { minHeight: 58, borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 7 }, competitionCopy: { flex: 1, minWidth: 0 }, competitionName: { fontSize: 13, fontWeight: "700", marginBottom: 3 }, roster: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 }, rosterItem: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" }, playerName: { fontSize: 13, fontWeight: "700" }, moreButton: { minHeight: 42, borderWidth: 0, borderRadius: 16, marginTop: 10, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, moreText: { fontSize: 12, fontWeight: "800" }, newsCard: { borderRadius: 18, paddingHorizontal: 14 }, newsItem: { minHeight: 76, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 14 }, newsIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" }, newsFavicon: { width: 24, height: 24 }, flag: { fontSize: 20 }, newsCopy: { flex: 1, gap: 5 }, newsTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" }, newsSummary: { fontSize: 11, lineHeight: 16 }, filterBar: { borderWidth: 0, borderRadius: 16, padding: 3, marginTop: 18, marginBottom: 14, flexDirection: "row" }, filter: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 13 }, filterText: { fontSize: 11, fontWeight: "800" }, playerRow: { minHeight: 62, borderWidth: 1, borderRadius: 11, padding: 11, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }, statsGrid: { borderWidth: 0, borderRadius: 20, padding: 8, flexDirection: "row", flexWrap: "wrap" }, statCard: { width: "50%", minHeight: 78, padding: 10, justifyContent: "center" }, statValue: { fontSize: 22, fontWeight: "800", marginBottom: 4 }, empty: { minHeight: 58, borderWidth: 1, borderRadius: 11, padding: 16, alignItems: "center", justifyContent: "center" }, center: { alignItems: "center", paddingTop: 50 }, message: { fontSize: 14 }, retry: { fontSize: 13, fontWeight: "700", marginTop: 10 }, skeleton: { height: 125, borderRadius: 16, marginBottom: 14 }, skeletonWide: { height: 62, borderRadius: 12, marginBottom: 10 },
});
