import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { EmptyState } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useNotifications, type AppNotification } from "@/context/NotificationsContext";
import { useColors } from "@/hooks/useColors";
import { toMatch } from "@/lib/api";
import type { Match } from "@/lib/data";
import { listTeamLabel } from "@/lib/matches";
import { openMatch } from "@/lib/navigation";
import { supabase } from "@/lib/supabase";

function when(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

// The matches behind the notifications, in one request, so each one can show both teams and the score.
async function fetchMatches(ids: string[]) {
  if (!ids.length) return {} as Record<string, Match>;
  const { data, error } = await supabase.from("matches").select("id, payload").in("id", ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.id as string, toMatch(row.payload as Parameters<typeof toMatch>[0])]));
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, markAllRead } = useNotifications();
  const ids = [...new Set(items.flatMap((item) => item.match_id ? [item.match_id] : []))];
  const matches = useQuery({ queryKey: ["notification-matches", ids], queryFn: () => fetchMatches(ids), enabled: ids.length > 0, staleTime: 60_000 });
  // Opening the list counts as reading it; the dots stay until the next visit.
  useEffect(() => () => { void markAllRead(); }, [markAllRead]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, 8) }}>
      <View style={styles.nav}><BackButton /><Text style={[styles.title, { color: colors.foreground }]}>Notificações</Text><View style={styles.spacer} /></View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 32 }}
        ListEmptyComponent={<EmptyState title="Nenhuma notificação ainda" description="Siga equipes para saber quando as partidas delas começam e terminam." />}
        renderItem={({ item }) => <NotificationCard item={item} match={item.match_id ? matches.data?.[item.match_id] : undefined} />}
      />
    </View>
  );
}

// A small scoreboard: what happened on top, both teams with the score below, the winner in front.
function NotificationCard({ item, match }: { item: AppNotification; match?: Match }) {
  const colors = useColors();
  const started = item.kind === "match_started";
  const label = started ? "Começou" : item.kind === "match_finished" ? "Fim de jogo" : "Teste";
  const tone = started ? colors.live : colors.mutedForeground;
  const scored = match && typeof match.scoreA === "number" && typeof match.scoreB === "number";
  return <Pressable accessibilityRole="button" accessibilityLabel={item.title} disabled={!item.match_id} onPress={() => item.match_id && openMatch(item.match_id, match)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}>
    <View style={styles.head}>
      {started ? <View style={[styles.liveDot, { backgroundColor: colors.live }]} /> : null}
      <Text style={[styles.event, { color: tone }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>{match?.tournament ?? item.body}</Text>
      <Text style={[styles.meta, { color: colors.mutedForeground }]}>{when(item.created_at)}</Text>
      {!item.read_at ? <View accessibilityLabel="Não lida" style={[styles.unread, { backgroundColor: colors.primary }]} /> : null}
    </View>
    {match ? <View style={styles.teams}>
      {([[match.teamA, match.scoreA, match.scoreB], [match.teamB, match.scoreB, match.scoreA]] as const).map(([team, own, other]) => {
        const lost = scored && !started && own! < other!;
        return <View key={team.id} style={styles.team}>
          <ResolvedLogo type="team" name={team.name} entityId={team.id} logoUrl={team.logoUrl} size={26} />
          <Text numberOfLines={1} style={[styles.name, { color: lost ? colors.mutedForeground : colors.foreground, fontFamily: lost ? font.medium : font.semibold }]}>{listTeamLabel(team)}</Text>
          {scored ? <Text style={[styles.score, { color: lost ? colors.mutedForeground : colors.foreground }]}>{own}</Text> : null}
        </View>;
      })}
    </View> : <Text style={[styles.fallback, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, marginBottom: 12 },
  title: { fontSize: 17, fontFamily: font.bold },
  spacer: { width: 44 },
  card: { borderRadius: 18, padding: 14, gap: 12, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  event: { fontSize: 12, fontFamily: font.bold },
  meta: { fontSize: 12, fontFamily: font.medium, flexShrink: 1 },
  unread: { width: 8, height: 8, borderRadius: 4, marginLeft: "auto" },
  teams: { gap: 8 },
  team: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, minWidth: 0, fontSize: 15 },
  score: { fontSize: 17, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  fallback: { fontSize: 14, lineHeight: 19, fontFamily: font.semibold },
});
