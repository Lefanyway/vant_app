import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ListSkeleton } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { absoluteLogo, fetchCompetitions } from "@/lib/api";
import { fetchInsights } from "@/lib/insights";
import { openCompetition } from "@/lib/navigation";

type Row = { id: string; name: string; meta: string; logoUrl?: string };

// Shown while a favorites list is empty: a prompt to add, plus the teams and competitions to start with.
export function FavoritesDiscover({ kind }: { kind: "teams" | "competitions" }) {
  const colors = useColors();
  const { favoriteTeams, favoriteCompetitions = [], toggleFavorite, toggleCompetition } = useApp();
  const insights = useQuery({ queryKey: ["insights"], queryFn: fetchInsights, staleTime: 10 * 60_000 });
  const competitions = useQuery({ queryKey: ["competitions", "valorant"], queryFn: () => fetchCompetitions("valorant"), staleTime: 10 * 60_000 });
  const teams: Row[] = (insights.data?.ranking ?? []).map((team) => ({ id: team.team_id, name: team.name, meta: `Elo ${Math.round(team.elo)}`, logoUrl: absoluteLogo(team.logo_url) }));
  const leagues: Row[] = (competitions.data ?? []).map((row) => ({ id: row.id, name: row.name, meta: row.region || "Valorant", logoUrl: row.logoUrl }));
  const sections = [
    { key: "teams", title: "Equipes em tendência", rows: teams, loading: insights.isLoading, saved: favoriteTeams, toggle: toggleFavorite, open: (id: string) => router.push(`/teams/${encodeURIComponent(id)}`), type: "team" as const },
    { key: "competitions", title: "Competições em tendência", rows: leagues, loading: competitions.isLoading, saved: favoriteCompetitions, toggle: toggleCompetition, open: (id: string) => openCompetition(id), type: "competition" as const },
  ];
  if (kind === "competitions") sections.reverse();
  return <View>
    <View style={styles.hero}>
      <Text style={[styles.heroTitle, { color: colors.foreground }]}>É hora de adicionar favoritos</Text>
      <Text style={[styles.heroCopy, { color: colors.mutedForeground }]}>As partidas das suas equipes e competições favoritas aparecem aqui.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/search")} style={[styles.add, { backgroundColor: colors.accent }]}>
        <View style={[styles.addIcon, { borderColor: colors.primary }]}><Feather name="plus" size={22} color={colors.primary} /></View>
        <Text style={[styles.addText, { color: colors.primary }]}>Adicionar</Text>
      </Pressable>
    </View>
    {sections.map(({ key, ...section }) => <Section key={key} {...section} />)}
  </View>;
}

function Section({ title, rows, loading, saved, toggle, open, type }: { title: string; rows: Row[]; loading: boolean; saved: string[]; toggle: (id: string) => void; open: (id: string) => void; type: "team" | "competition" }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  if (!loading && rows.length === 0) return null;
  return <View style={[styles.panel, { backgroundColor: colors.card }]}>
    <Text style={[styles.panelTitle, { color: colors.foreground }]}>{title}</Text>
    {loading ? <ListSkeleton count={1} /> : rows.slice(0, expanded ? 10 : 5).map((row) => {
      const on = saved.includes(row.id);
      return <View key={row.id} style={styles.row}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Abrir ${row.name}`} onPress={() => open(row.id)} style={styles.link}>
          <ResolvedLogo type={type} entityId={row.id} name={row.name} logoUrl={row.logoUrl} size={32} />
          <View style={styles.copy}><Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{row.name}</Text><Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>{row.meta}</Text></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={on ? `Deixar de seguir ${row.name}` : `Seguir ${row.name}`} onPress={() => toggle(row.id)} style={styles.star}><Ionicons name={on ? "star" : "star-outline"} size={22} color={on ? colors.primary : colors.mutedForeground} /></Pressable>
      </View>;
    })}
    {!loading && rows.length > 5 ? <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={styles.more}><Text style={[styles.moreText, { color: colors.primary }]}>{expanded ? "Ver menos" : "Veja mais"}</Text><Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} /></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 8 },
  heroTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  heroCopy: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  add: { marginTop: 12, width: 160, height: 104, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  addIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  addText: { fontSize: 15, fontWeight: "700" },
  panel: { borderRadius: 22, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, marginBottom: 12 },
  panelTitle: { fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center" },
  link: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
  star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  more: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  moreText: { fontSize: 14, fontWeight: "600" },
});
