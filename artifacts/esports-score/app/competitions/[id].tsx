import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { ListSkeleton } from "@/components/MobileChrome";
import { MatchCard } from "@/components/MatchCard";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import { errorMessage, fetchCompetition, fetchCompetitionMatches, toMatch } from "@/lib/api";
import { openMatch } from "@/lib/navigation";

export default function CompetitionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const competitionId = String(id ?? "");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const competition = useQuery({ queryKey: ["competition", competitionId], queryFn: () => fetchCompetition(competitionId), enabled: Boolean(competitionId) });
  const upcoming = useQuery({ queryKey: ["competition-matches", competitionId, "upcoming"], queryFn: () => fetchCompetitionMatches(competitionId, "upcoming"), enabled: Boolean(competitionId) });
  const finished = useQuery({ queryKey: ["competition-matches", competitionId, "finished"], queryFn: () => fetchCompetitionMatches(competitionId, "finished"), enabled: Boolean(competitionId) });
  const game = competition.data?.gameId === "cs2" ? "CS2" : competition.data?.gameId === "lol" ? "League of Legends" : competition.data?.gameId === "valorant" ? "Valorant" : "";
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.nav, { paddingTop: Math.max(insets.top, 14), paddingHorizontal: 16 }]}><BackButton /><View style={styles.navSpacer} /></View>
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 48 }}>
      {competition.isLoading && !competition.data ? <ListSkeleton />
        : competition.isError || !competition.data ? (
          <View style={styles.center}>
            <Text style={[styles.message, { color: colors.mutedForeground }]}>{competition.isError ? errorMessage(competition.error, "Não foi possível carregar a competição.") : "Competição não encontrada."}</Text>
            <Pressable accessibilityRole="button" onPress={() => competition.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Tentar de novo</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ResolvedLogo type="competition" name={competition.data.name} entityId={competition.data.id} logoUrl={competition.data.logoUrl} size={52} />
              <View style={styles.copy}>
                <Text style={[styles.name, { color: colors.foreground }]}>{competition.data.name}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{[game, competition.data.serieName ?? competition.data.region].filter(Boolean).join(" · ") || "Competição"}</Text>
              </View>
            </View>
            <MatchSection title="Próximas partidas" query={upcoming} colors={colors} empty="Nenhuma partida agendada." />
            <MatchSection title="Resultados" query={finished} colors={colors} empty="Nenhum resultado disponível." />
          </>
        )}
    </ScrollView>
    </View>
  );
}

function MatchSection({ title, query, colors, empty }: { title: string; query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; data?: { matches: Parameters<typeof toMatch>[0][] } }; colors: ReturnType<typeof useColors>; empty: string }) {
  const matches = query.data?.matches.map(toMatch) ?? [];
  return (
    <View>
      <Text style={[styles.section, { color: colors.mutedForeground }]}>{title}</Text>
      {query.isLoading && !query.data ? <ListSkeleton count={2} />
        : query.isError && !query.data ? <View><Text style={[styles.message, { color: colors.mutedForeground }]}>{errorMessage(query.error, "Não foi possível carregar as partidas.")}</Text><Pressable accessibilityRole="button" onPress={() => query.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Tentar de novo</Text></Pressable></View>
          : matches.length === 0 ? <Text style={[styles.message, { color: colors.mutedForeground }]}>{empty}</Text>
            : matches.map((match) => <MatchCard key={match.id} match={match} onPress={() => openMatch(match.id, match)} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navTitle: { fontSize: 14, fontWeight: "700" },
  navSpacer: { width: 44 },
  header: { borderWidth: 0, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 22, fontWeight: "800" },
  meta: { fontSize: 13, marginTop: 6 },
  section: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 9 },
  message: { fontSize: 14, marginTop: 8 },
  retry: { fontSize: 13, fontWeight: "700", marginTop: 10 },
  center: { alignItems: "center", paddingTop: 40 },
});
