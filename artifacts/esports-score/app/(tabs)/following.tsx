import { Ionicons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileHeader, ScreenTabs, EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { CompetitionListItem } from "@/components/CompetitionListItem";
import { MatchCard, TeamBadge } from "@/components/MatchCard";
import { TeamLink } from "@/components/TeamLink";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchCompetitions, fetchFollowedMatches, fetchMatch, fetchTeam, toApiTeam, type ApiTeamDetails } from "@/lib/api";
import type { Team } from "@/lib/data";
import { openCompetition, openMatch } from "@/lib/navigation";
function asTeam(value: Team | ApiTeamDetails): Team { return "short" in value && "game" in value ? value : toApiTeam(value); }
export default function Following() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"matches" | "teams" | "competitions">("teams");
  const { favoriteTeams, favoriteCompetitions = [], favoriteMatches = [], favoritesReady = true, toggleFavorite, migrateFavorite } = useApp();
  const teamsQuery = useQuery({ queryKey: ["teams", favoriteTeams], enabled: favoritesReady && favoriteTeams.length > 0, queryFn: async () => {
    const results: PromiseSettledResult<Team>[] = [];
    for (let offset = 0; offset < favoriteTeams.length; offset += 3) {
      results.push(...await Promise.allSettled(favoriteTeams.slice(offset, offset + 3).map(async id => { const team = await fetchTeam(id); migrateFavorite?.(id, team.id); return team; })));
    }
    const teams = results.flatMap(row => row.status === "fulfilled" ? [row.value] : []);
    if (!teams.length) throw new Error("Não foi possível carregar as equipes.");
    return teams;
  }, staleTime: 10 * 60_000 });
  const followedMatches = useQuery({ queryKey: ["followed-matches", favoriteTeams], enabled: tab === "matches" && favoritesReady && favoriteTeams.length > 0, queryFn: () => fetchFollowedMatches(favoriteTeams) });
  const savedMatches = useQuery({ queryKey: ["saved-matches", favoriteMatches], enabled: tab === "matches" && favoritesReady && favoriteMatches.length > 0, queryFn: async () => {
    const results = await Promise.allSettled(favoriteMatches.map(id => fetchMatch(id)));
    const rows = results.flatMap(row => row.status === "fulfilled" ? [row.value] : []);
    if (!rows.length && favoriteMatches.length) throw new Error("Não foi possível carregar as partidas salvas.");
    return rows;
  } });
  const competitionsQuery = useQuery({ queryKey: ["competitions", "valorant"], queryFn: () => fetchCompetitions("valorant"), enabled: tab === "competitions" && favoriteCompetitions.length > 0, staleTime: 10 * 60_000 });
  const teams = ((teamsQuery.data ?? []) as Array<Team | ApiTeamDetails>).map(asTeam);
  const matches = [...new Map([...(savedMatches.data ?? []), ...(followedMatches.data?.matches ?? [])].map(match => [match.id, match])).values()];
  const competitions = (competitionsQuery.data ?? []).filter(row => favoriteCompetitions.includes(row.id));
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <MobileHeader><ScreenTabs items={[{ key: "matches", label: "Partidas" }, { key: "teams", label: "Equipes" }, { key: "competitions", label: "Competições" }]} selected={tab} onChange={setTab} /></MobileHeader>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: 110 + insets.bottom }}>
      {tab === "teams" ? !favoritesReady || favoriteTeams.length > 0 && teamsQuery.isLoading ? <ListSkeleton /> : teamsQuery.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => void teamsQuery.refetch()} /> : teams.length === 0 ? <EmptyState title="Suas equipes favoritas" description="Busque uma equipe e toque na estrela para acompanhá-la aqui." /> : teams.map(team => <View key={team.id} style={[styles.row, { backgroundColor: colors.card }]}>
        <View style={styles.link}><TeamLink team={team} compact><TeamBadge {...team} size={38} /><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{team.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Valorant</Text></View></TeamLink></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Deixar de seguir ${team.name}`} onPress={() => toggleFavorite(team.id)} style={styles.star}><Ionicons name="star" size={23} color={colors.primary} /></Pressable>
      </View>) : tab === "matches" ? savedMatches.isLoading || followedMatches.isLoading ? <ListSkeleton /> : matches.length ? matches.map(match => <MatchCard key={match.id} match={match} onPress={() => openMatch(match.id, match)} />) : savedMatches.isError || followedMatches.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => { void savedMatches.refetch(); void followedMatches.refetch(); }} /> : <EmptyState title="Suas partidas favoritas" description="Salve partidas ou siga equipes para acompanhar os próximos confrontos." /> : competitionsQuery.isLoading ? <ListSkeleton /> : competitionsQuery.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => void competitionsQuery.refetch()} /> : competitions.length ? competitions.map(row => <CompetitionListItem key={row.id} id={row.id} name={row.name} region={row.region || "Valorant"} logoUrl={row.logoUrl} onPress={() => openCompetition(row.id)} />) : <EmptyState title="Suas competições favoritas" description="Toque na estrela de um campeonato para fixá-lo aqui." />}
      {tab === "teams" && teams.length > 0 && teams.length < favoriteTeams.length ? <Pressable onPress={() => void teamsQuery.refetch()} style={{ padding: 12 }}><Text style={[styles.meta, { color: colors.mutedForeground }]}>Algumas equipes não puderam ser atualizadas. Seus favoritos continuam salvos. Toque para tentar novamente.</Text></Pressable> : null}
      {tab === "matches" && matches.length > 0 && (savedMatches.isError || followedMatches.isError || followedMatches.data?.partial) ? <Text style={[styles.meta, { color: colors.mutedForeground, padding: 12 }]}>Algumas partidas não puderam ser atualizadas.</Text> : null}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ row: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 5, minHeight: 65 }, link: { flex: 1, minWidth: 0 }, copy: { flex: 1, minWidth: 0, marginLeft: 12, justifyContent: "center" }, name: { fontSize: 16, lineHeight: 22 }, meta: { fontSize: 12, marginTop: 3 }, star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });

