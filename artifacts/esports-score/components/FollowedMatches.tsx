import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { MatchCard } from "@/components/MatchCard";
import { UpcomingCard } from "@/components/UpcomingCard";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import { fetchCompetitionMatches, fetchTeamMatches, toMatch } from "@/lib/api";
import type { Match } from "@/lib/data";
import { openMatch } from "@/lib/navigation";

const dayKey = (iso: string) => { const date = new Date(iso); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };
const dayLabel = (iso: string) => { const date = new Date(iso); return `${date.toLocaleDateString("pt-BR", { weekday: "short" })} · ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`; };

// Upcoming matches of everything the user follows, one card per day, split by competition inside it.
export function FollowedMatches({ kind, ids, filter = "upcoming" }: { kind: "team" | "competition"; ids: string[]; filter?: "upcoming" | "finished" }) {
  const colors = useColors();
  const query = useQuery({
    queryKey: ["followed-matches", kind, ids, filter], staleTime: 5 * 60_000,
    queryFn: async () => {
      const pages = await Promise.allSettled(ids.slice(0, 12).map((id) => kind === "team" ? fetchTeamMatches(id, filter) : fetchCompetitionMatches(id, filter)));
      const rows = pages.flatMap((page) => page.status === "fulfilled" ? page.value.matches : []);
      const matches = [...new Map(rows.map((row) => [row.id, toMatch(row)])).values()].filter((match) => match.startTime);
      // Upcoming reads forward from today; past results start with the most recent.
      const direction = filter === "upcoming" ? 1 : -1;
      return matches.sort((a, b) => direction * (Date.parse(a.startTime!) - Date.parse(b.startTime!))).slice(0, filter === "upcoming" ? 30 : 15);
    },
  });
  if (query.isLoading) return <ListSkeleton />;
  if (query.isError) return <EmptyState title="Não foi possível carregar" onRetry={() => void query.refetch()} />;
  const days = new Map<string, Match[]>();
  for (const match of query.data ?? []) days.set(dayKey(match.startTime!), [...(days.get(dayKey(match.startTime!)) ?? []), match]);
  if (!days.size) return filter === "upcoming" ? <Text style={[styles.none, { color: colors.mutedForeground }]}>Nenhuma partida marcada por enquanto.</Text> : null;
  // Upcoming matches use the standard card; past results stay grouped by day.
  if (filter === "upcoming") return <View>{(query.data ?? []).map((match) => <UpcomingCard key={match.id} match={match} />)}</View>;
  return <View>
    {[...days.values()].map((matches) => {
      const competitions = new Map<string, Match[]>();
      for (const match of matches) competitions.set(match.tournament, [...(competitions.get(match.tournament) ?? []), match]);
      return <View key={dayKey(matches[0].startTime!)} style={[styles.day, { backgroundColor: colors.card }]}>
        <Text style={[styles.dayTitle, { color: colors.foreground }]}>{dayLabel(matches[0].startTime!)}</Text>
        {[...competitions.entries()].map(([name, group]) => <View key={name}>
          <View style={styles.competition}>
            <ResolvedLogo type="competition" name={name} entityId={group[0].competitionId} logoUrl={group[0].competitionLogoUrl} size={22} />
            <Text numberOfLines={1} style={[styles.competitionName, { color: colors.mutedForeground }]}>{name}</Text>
          </View>
          {group.map((match) => <MatchCard key={match.id} match={match} onPress={() => openMatch(match.id, match)} />)}
        </View>)}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  day: { borderRadius: 22, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, marginBottom: 12 },
  dayTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  competition: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, paddingBottom: 4 },
  competitionName: { flex: 1, fontSize: 12, fontWeight: "600" },
  none: { fontSize: 14, paddingHorizontal: 4, paddingVertical: 8 },
});
