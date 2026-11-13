import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ListSkeleton } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type Followed = { kind: "team" | "competition"; entity_id: string; notify: boolean | null; name: string; logo_url?: string };

// The account's followed teams and competitions, with names and logos from the stored catalog.
async function fetchFollowed(): Promise<Followed[]> {
  const kinds = ["team", "competition"];
  let { data, error } = await supabase.from("favorites").select("kind, entity_id, notify").in("kind", kinds);
  // Until the notify column exists in the database, list the favorites anyway and hide the bell (notify: null).
  if (error && (error.code === "42703" || /notify/i.test(error.message))) {
    const plain = await supabase.from("favorites").select("kind, entity_id").in("kind", kinds);
    data = (plain.data ?? []).map((row) => ({ ...row, notify: null }));
    error = plain.error;
  }
  if (error) throw error;
  const ids = (kind: string) => (data ?? []).filter((row) => row.kind === kind).map((row) => row.entity_id as string);
  const [teams, competitions] = await Promise.all([
    supabase.from("teams").select("id, name, logo_url").in("id", ids("team")),
    supabase.from("competitions").select("id, name, logo_url").in("id", ids("competition")),
  ]);
  const names = new Map([...(teams.data ?? []), ...(competitions.data ?? [])].map((row) => [row.id as string, row]));
  return (data ?? []).map((row) => ({ ...(row as Omit<Followed, "name">), name: names.get(row.entity_id)?.name ?? "Sem nome", logo_url: names.get(row.entity_id)?.logo_url ?? undefined }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

// Profile section: mute a favorite's notifications without unfollowing it, or unfollow it.
export function FollowingSettings() {
  const colors = useColors();
  const client = useQueryClient();
  const { favoriteTeams, favoriteCompetitions, toggleFavorite, toggleCompetition } = useApp();
  const query = useQuery({ queryKey: ["followed", favoriteTeams, favoriteCompetitions], queryFn: fetchFollowed });
  const setNotify = async (item: Followed) => {
    client.setQueryData<Followed[]>(["followed", favoriteTeams, favoriteCompetitions], (rows) => rows?.map((row) => row.entity_id === item.entity_id ? { ...row, notify: !item.notify } : row));
    const { error } = await supabase.from("favorites").update({ notify: !item.notify }).match({ kind: item.kind, entity_id: item.entity_id });
    if (error) void query.refetch();
  };
  const rows = query.data ?? [];
  return (
    <View style={[styles.panel, { backgroundColor: colors.card }]}>
      {query.isLoading ? <ListSkeleton count={1} />
        : query.isError ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Não foi possível carregar seus favoritos.</Text>
        : !rows.length ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Siga equipes e competições pela busca para recebê-las aqui.</Text>
        : rows.map((item, index) => (
          <View key={`${item.kind}:${item.entity_id}`} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Pressable accessibilityRole="link" accessibilityLabel={`Abrir ${item.name}`} onPress={() => router.push(item.kind === "team" ? `/teams/${encodeURIComponent(item.entity_id)}` : `/competitions/${encodeURIComponent(item.entity_id)}`)} style={styles.open}>
            <ResolvedLogo type={item.kind} name={item.name} entityId={item.entity_id} logoUrl={item.logo_url} size={30} />
            <View style={styles.copy}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{item.name.trim()}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.kind === "team" ? "Equipe" : "Competição"}{item.notify === null ? "" : item.notify ? " · com avisos" : " · sem avisos"}</Text>
            </View>
            </Pressable>
            {item.notify === null ? null : <Pressable accessibilityRole="switch" accessibilityState={{ checked: item.notify }} accessibilityLabel={`Avisos de ${item.name}`} onPress={() => void setNotify(item)} style={styles.icon}>
              <Feather name={item.notify ? "bell" : "bell-off"} size={20} color={item.notify ? colors.primary : colors.mutedForeground} />
            </Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel={`Deixar de seguir ${item.name}`} onPress={() => (item.kind === "team" ? toggleFavorite : toggleCompetition)(item.entity_id)} style={styles.icon}>
              <Ionicons name="star" size={20} color={colors.primary} />
            </Pressable>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 20, paddingHorizontal: 14 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10 },
  open: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, fontFamily: font.medium },
  meta: { fontSize: 12, fontFamily: font.regular },
  icon: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  empty: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, paddingVertical: 18 },
});
