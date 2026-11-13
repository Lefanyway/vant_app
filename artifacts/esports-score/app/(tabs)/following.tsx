import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileHeader, ScreenTabs, EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { SwipeTabs } from "@/components/SwipeTabs";
import { FavoritesDiscover } from "@/components/FavoritesDiscover";
import { CompetitionListItem } from "@/components/CompetitionListItem";
import { TeamBadge } from "@/components/MatchCard";
import { TeamLink } from "@/components/TeamLink";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchCompetitions, fetchTeam, toApiTeam, type ApiTeamDetails } from "@/lib/api";
import type { Team } from "@/lib/data";
import { openCompetition } from "@/lib/navigation";
function asTeam(value: Team | ApiTeamDetails): Team { return "short" in value && "game" in value ? value : toApiTeam(value); }
export default function Following() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"teams" | "competitions">("teams");
  const { favoriteTeams, favoriteCompetitions = [], favoritesReady = true, toggleFavorite, migrateFavorite } = useApp();
  const teamsQuery = useQuery({ queryKey: ["teams", favoriteTeams], enabled: favoritesReady && favoriteTeams.length > 0, queryFn: async () => {
    const results: PromiseSettledResult<Team>[] = [];
    for (let offset = 0; offset < favoriteTeams.length; offset += 3) {
      results.push(...await Promise.allSettled(favoriteTeams.slice(offset, offset + 3).map(async id => { const team = await fetchTeam(id); migrateFavorite?.(id, team.id); return team; })));
    }
    const teams = results.flatMap(row => row.status === "fulfilled" ? [row.value] : []);
    if (!teams.length) throw new Error("Não foi possível carregar as equipes.");
    return teams;
  }, staleTime: 10 * 60_000 });
  const competitionsQuery = useQuery({ queryKey: ["competitions", "valorant"], queryFn: () => fetchCompetitions("valorant"),  staleTime: 10 * 60_000 });
  const teams = ((teamsQuery.data ?? []) as Array<Team | ApiTeamDetails>).map(asTeam);
  const competitions = (competitionsQuery.data ?? []).filter(row => favoriteCompetitions.includes(row.id));
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <MobileHeader><ScreenTabs items={[{ key: "teams", label: "Equipes" }, { key: "competitions", label: "Competições" }]} selected={tab} onChange={setTab} /></MobileHeader>
    <SwipeTabs tabs={["teams", "competitions"] as const} selected={tab} onChange={setTab}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: 110 + insets.bottom }}>
      {tab === "teams" ? !favoritesReady || favoriteTeams.length > 0 && teamsQuery.isLoading ? <ListSkeleton /> : teamsQuery.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => void teamsQuery.refetch()} /> : teams.length === 0 ? <FavoritesDiscover kind="teams" /> : teams.map(team => <View key={team.id} style={[styles.row, { backgroundColor: colors.card }]}>
        <View style={styles.link}><TeamLink team={team} compact><TeamBadge {...team} size={38} /><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{team.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Valorant</Text></View></TeamLink></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Deixar de seguir ${team.name}`} onPress={() => toggleFavorite(team.id)} style={styles.star}><Ionicons name="star" size={23} color={colors.primary} /></Pressable>
      </View>) : favoriteCompetitions.length === 0 ? <FavoritesDiscover kind="competitions" /> : competitionsQuery.isLoading ? <ListSkeleton /> : competitionsQuery.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => void competitionsQuery.refetch()} /> : competitions.length ? competitions.map(row => <CompetitionListItem key={row.id} id={row.id} name={row.name} region={row.region || "Valorant"} logoUrl={row.logoUrl} onPress={() => openCompetition(row.id)} />) : <FavoritesDiscover kind="competitions" />}
      {tab === "teams" && teams.length > 0 && teams.length < favoriteTeams.length ? <Pressable onPress={() => void teamsQuery.refetch()} style={{ padding: 12 }}><Text style={[styles.meta, { color: colors.mutedForeground }]}>Algumas equipes não puderam ser atualizadas. Seus favoritos continuam salvos. Toque para tentar novamente.</Text></Pressable> : null}
    </ScrollView>
    </SwipeTabs>
  </View>;
}
const styles = StyleSheet.create({ row: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 5, minHeight: 65 }, link: { flex: 1, minWidth: 0 }, copy: { flex: 1, minWidth: 0, marginLeft: 12, justifyContent: "center" }, name: { fontSize: 16, lineHeight: 22 }, meta: { fontSize: 12, marginTop: 3 }, star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });

