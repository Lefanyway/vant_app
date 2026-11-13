import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MatchCard } from "@/components/MatchCard";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useColors } from "@/hooks/useColors";
import type { Match } from "@/lib/data";
import { listTeamLabel } from "@/lib/matches";
import { openMatch } from "@/lib/navigation";

type Team = Match["teamA"];

// Recent matches of one team at a time: a selector with both teams, then the matches grouped by competition.
export function RecentByTeam({ teams, matchesByTeam }: { teams: [Team, Team]; matchesByTeam: Record<string, Match[]> }) {
  const colors = useColors();
  const [selected, setSelected] = useState(teams[0].id);
  const matches = matchesByTeam[selected] ?? [];
  return <View>
    <Text style={[styles.title, { color: colors.mutedForeground }]}>Últimas partidas</Text>
    <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: colors.card }]}>
      {teams.map((team) => {
        const on = team.id === selected;
        return <Pressable key={team.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Últimas partidas de ${team.name}`} onPress={() => setSelected(team.id)} style={[styles.option, on && { backgroundColor: colors.secondary }]}>
          <ResolvedLogo type="team" name={team.name} entityId={team.id} logoUrl={team.logoUrl} size={22} />
          <Text numberOfLines={1} style={[styles.optionText, { color: on ? colors.foreground : colors.mutedForeground }]}>{listTeamLabel(team, 12)}</Text>
        </Pressable>;
      })}
    </View>
    {!matches.length ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Nenhuma partida recente disponível.</Text> : <CompetitionGroups matches={matches} />}
  </View>;
}

// Past matches in one card per competition, each match with its date: the standard for results lists.
export function CompetitionGroups({ matches }: { matches: Match[] }) {
  const colors = useColors();
  const groups = new Map<string, Match[]>();
  for (const match of matches) groups.set(match.tournament, [...(groups.get(match.tournament) ?? []), match]);
  return <View>
    {[...groups.entries()].map(([name, group]) => <View key={name} style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <ResolvedLogo type="competition" name={name} entityId={group[0].competitionId} logoUrl={group[0].competitionLogoUrl} size={34} />
          <View style={styles.copy}>
            <Text numberOfLines={1} style={[styles.competition, { color: colors.foreground }]}>{name}</Text>
            {group[0].stage && !name.includes(group[0].stage) ? <Text numberOfLines={1} style={[styles.stage, { color: colors.mutedForeground }]}>{group[0].stage}</Text> : null}
          </View>
        </View>
        {group.map((match) => <MatchCard key={match.id} match={match} showDay onPress={() => openMatch(match.id, match)} />)}
      </View>)}
  </View>;
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 9 },
  segment: { flexDirection: "row", borderRadius: 22, padding: 3, marginBottom: 10 },
  option: { flex: 1, minWidth: 0, minHeight: 38, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10 },
  optionText: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 22, paddingHorizontal: 14, paddingTop: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8 },
  copy: { flex: 1, minWidth: 0 },
  competition: { fontSize: 14, fontWeight: "700" },
  stage: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, paddingVertical: 12, paddingHorizontal: 4 },
});
