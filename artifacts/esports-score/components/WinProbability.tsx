import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import type { Match } from "@/lib/data";
import { hasScore, listTeamLabel } from "@/lib/matches";
import { supabase } from "@/lib/supabase";

type Prediction = { home_win_prob: number; home_elo: number; away_elo: number; model_runs: { metrics: { model?: { accuracy?: number } } } | null };

async function fetchPrediction(matchId: string): Promise<Prediction | null> {
  const { data, error } = await supabase.from("predictions").select("home_win_prob, home_elo, away_elo, model_runs(metrics)").eq("match_id", matchId).maybeSingle();
  if (error) throw error;
  return data as Prediction | null;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

// The VANT model's chance of each team winning: before the match for finished ones, current for the rest.
export function WinProbability({ match }: { match: Match }) {
  const colors = useColors();
  const { data } = useQuery({ queryKey: ["prediction", match.id], queryFn: () => fetchPrediction(match.id), staleTime: 10 * 60_000 });
  if (!data) return null;
  const home = data.home_win_prob;
  const favoriteHome = home >= 0.5;
  const finished = match.status === "Finished" && hasScore(match);
  const homeWon = finished && (match.scoreA ?? 0) > (match.scoreB ?? 0);
  const hit = finished && homeWon === favoriteHome;
  const accuracy = data.model_runs?.metrics?.model?.accuracy;
  return (
    <View accessibilityLabel={`Chance de vitória: ${match.teamA.name} ${percent(home)}, ${match.teamB.name} ${percent(1 - home)}`}>
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Chance de vitória</Text>
      <View style={[styles.panel, { backgroundColor: colors.card }]}>
        <View style={styles.teams}>
          <View style={styles.side}>
            <Text numberOfLines={1} style={[styles.team, { color: colors.mutedForeground }]}>{listTeamLabel(match.teamA)}</Text>
            <Text style={[styles.value, { color: favoriteHome ? colors.primary : colors.foreground }]}>{percent(home)}</Text>
          </View>
          <View style={[styles.side, styles.right]}>
            <Text numberOfLines={1} style={[styles.team, { color: colors.mutedForeground }]}>{listTeamLabel(match.teamB)}</Text>
            <Text style={[styles.value, { color: favoriteHome ? colors.foreground : colors.primary }]}>{percent(1 - home)}</Text>
          </View>
        </View>
        <View style={[styles.bar, { backgroundColor: colors.secondary }]}>
          <View style={[styles.fill, { width: `${Math.round(home * 100)}%`, backgroundColor: favoriteHome ? colors.primary : colors.mutedForeground }]} />
        </View>
        <View style={styles.caption}>
          {finished
            ? <><Feather name={hit ? "check-circle" : "x-circle"} size={14} color={hit ? colors.positive : colors.destructive} /><Text style={[styles.captionText, { color: colors.mutedForeground }]}>{hit ? "O modelo acertou o vencedor" : "O modelo errou o vencedor"} · previsão feita antes da partida</Text></>
            : <><Feather name="trending-up" size={14} color={colors.mutedForeground} /><Text style={[styles.captionText, { color: colors.mutedForeground }]}>Elo {Math.round(data.home_elo)} × {Math.round(data.away_elo)}{typeof accuracy === "number" ? ` · acerta ${percent(accuracy)} nos testes` : ""}</Text></>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontFamily: font.semibold, marginTop: 24, marginBottom: 9 },
  panel: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 16, gap: 12 },
  teams: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  side: { flex: 1, minWidth: 0, gap: 2 },
  right: { alignItems: "flex-end" },
  team: { fontSize: 12, fontFamily: font.semibold },
  value: { fontSize: 24, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  bar: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  caption: { flexDirection: "row", alignItems: "center", gap: 6 },
  captionText: { flex: 1, fontSize: 12, fontFamily: font.medium, lineHeight: 16 },
});
