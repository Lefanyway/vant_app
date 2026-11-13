import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileHeader, ScreenTabs, ListSkeleton } from "@/components/MobileChrome";
import { SwipeTabs } from "@/components/SwipeTabs";
import { FavoritesDiscover } from "@/components/FavoritesDiscover";
import { FollowedMatches } from "@/components/FollowedMatches";
import { TeamFocus } from "@/components/TeamFocus";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchCompetitions, fetchTeam } from "@/lib/api";
import { openCompetition, openTeam } from "@/lib/navigation";
import type { Team } from "@/lib/data";

type Followed = { id: string; name: string; logoUrl?: string; open: () => void };

export default function Following() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"teams" | "competitions">("teams");
  // Tapping a followed team or competition narrows the matches to it; tapping again shows all.
  const [picked, setPicked] = useState<string | null>(null);
  const changeTab = (next: "teams" | "competitions") => { setTab(next); setPicked(null); };
  const { favoriteTeams, favoriteCompetitions = [], favoritesReady = true, migrateFavorite } = useApp();
  const teamsQuery = useQuery({ queryKey: ["teams", favoriteTeams], enabled: favoritesReady && favoriteTeams.length > 0, queryFn: async () => {
    const results: PromiseSettledResult<Team>[] = [];
    for (let offset = 0; offset < favoriteTeams.length; offset += 3) {
      results.push(...await Promise.allSettled(favoriteTeams.slice(offset, offset + 3).map(async id => { const team = await fetchTeam(id); migrateFavorite?.(id, team.id); return team; })));
    }
    return results.flatMap(row => row.status === "fulfilled" ? [row.value] : []);
  }, staleTime: 10 * 60_000 });
  const competitionsQuery = useQuery({ queryKey: ["competitions", "valorant"], queryFn: () => fetchCompetitions("valorant"), enabled: favoriteCompetitions.length > 0, staleTime: 10 * 60_000 });
  // New users get suggestions; anyone who already follows something sees their teams and matches.
  const isNew = favoritesReady && favoriteTeams.length === 0 && favoriteCompetitions.length === 0;
  const kind = tab === "teams" ? "team" : "competition";
  const allIds = tab === "teams" ? favoriteTeams : favoriteCompetitions;
  const ids = picked && allIds.includes(picked) ? [picked] : allIds;
  const followed: Followed[] = tab === "teams"
    ? (teamsQuery.data ?? []).map(team => ({ id: team.id, name: team.name, logoUrl: team.logoUrl, open: () => openTeam(team) }))
    : (competitionsQuery.data ?? []).filter(row => favoriteCompetitions.includes(row.id)).map(row => ({ id: row.id, name: row.name, logoUrl: row.logoUrl, open: () => openCompetition(row.id) }));
  const stripLoading = tab === "teams" ? teamsQuery.isLoading : competitionsQuery.isLoading;
  const add = () => router.push({ pathname: "/favorites/add", params: { kind } });
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <MobileHeader><ScreenTabs items={[{ key: "teams", label: "Equipes" }, { key: "competitions", label: "Competições" }]} selected={tab} onChange={changeTab} /></MobileHeader>
    <SwipeTabs tabs={["teams", "competitions"] as const} selected={tab} onChange={changeTab}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: 110 + insets.bottom }}>
      {!favoritesReady ? <ListSkeleton /> : isNew ? <FavoritesDiscover kind={tab} /> : <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {stripLoading ? <ListSkeleton count={1} /> : followed.map(item => <Pressable key={item.id} testID={`${kind}-chip-${item.id}`} accessibilityRole="button" accessibilityState={{ selected: picked === item.id }} accessibilityLabel={`Mostrar partidas de ${item.name}`} onPress={() => setPicked(current => current === item.id ? null : item.id)} style={[styles.chip, picked && picked !== item.id ? { opacity: 0.45 } : null]}>
            <View style={[styles.ring, { borderColor: picked === item.id ? colors.primary : "transparent" }]}><ResolvedLogo type={kind} entityId={item.id} name={item.name} logoUrl={item.logoUrl} size={52} /></View>
            <Text numberOfLines={1} style={[styles.chipName, { color: picked === item.id ? colors.primary : colors.foreground }]}>{item.name}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel={tab === "teams" ? "Adicionar equipes" : "Adicionar competições"} onPress={add} style={styles.chip}>
            <View style={[styles.addTile, { borderColor: colors.primary }]}><Feather name="plus" size={22} color={colors.primary} /></View>
            <Text style={[styles.chipName, { color: colors.primary }]}>Adicionar</Text>
          </Pressable>
        </ScrollView>
        {tab === "teams" && picked && followed.find(item => item.id === picked) ? <TeamFocus teamId={picked} onSeeAll={() => followed.find(item => item.id === picked)?.open()} /> : <>
        {picked && followed.some(item => item.id === picked) ? <Pressable testID={`${kind}-link-${picked}`} accessibilityRole="link" onPress={() => followed.find(item => item.id === picked)?.open()} style={styles.openLink}><Text style={[styles.openText, { color: colors.primary }]}>Ver página de {followed.find(item => item.id === picked)?.name}</Text></Pressable> : null}
        <Text style={[styles.section, { color: colors.mutedForeground }]}>Próximas partidas</Text>
        {ids.length ? <FollowedMatches kind={kind} ids={ids} /> : <Text style={[styles.empty, { color: colors.mutedForeground }]}>{tab === "teams" ? "Você ainda não segue nenhuma equipe." : "Você ainda não segue nenhuma competição."}</Text>}
        {ids.length ? <><Text style={[styles.section, { color: colors.mutedForeground }]}>Últimas partidas</Text><FollowedMatches kind={kind} ids={ids} filter="finished" /></> : null}
        </>}
      </>}
    </ScrollView>
    </SwipeTabs>
  </View>;
}
const styles = StyleSheet.create({
  strip: { gap: 14, paddingHorizontal: 6, paddingVertical: 4 },
  chip: { width: 68, alignItems: "center", gap: 6 },
  chipName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  ring: { borderWidth: 2, borderRadius: 14, padding: 2 },
  openLink: { minHeight: 40, justifyContent: "center", paddingHorizontal: 6 },
  openText: { fontSize: 13, fontWeight: "600" },
  addTile: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  section: { fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 9, marginHorizontal: 4 },
  empty: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
});
