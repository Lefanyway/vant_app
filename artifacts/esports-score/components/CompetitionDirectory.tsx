import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import type { ApiCompetition } from "@/lib/api";
import { openCompetition } from "@/lib/navigation";
import { CompetitionListItem } from "./CompetitionListItem";
export function competitionRegion(competition: ApiCompetition) {
  if (competition.region) return competition.region;
  if (/americas/i.test(competition.name)) return "Americas";
  if (/emea/i.test(competition.name)) return "EMEA";
  if (/pacific/i.test(competition.name)) return "Pacific";
  if (/china|\bcn\b/i.test(competition.name)) return "China";
  if (/brazil|brasil/i.test(competition.name)) return "Brasil";
  if (/\bvct\b|champions|masters/i.test(competition.name)) return "Circuito VCT";
  if (/challenger|\bvcl\b|\bvrl\b/i.test(competition.name)) return "Challengers";
  if (/game.?changers/i.test(competition.name)) return "Game Changers";
  return "Outras competições";
}
export function CompetitionDirectory({ competitions }: { competitions: ApiCompetition[] }) {
  const colors = useColors();
  const { favoriteCompetitions = [] } = useApp();
  const [expanded, setExpanded] = useState<string[]>(["Fixadas"]);
  const groups = useMemo(() => {
    const map = new Map<string, ApiCompetition[]>();
    map.set("Fixadas", competitions.filter(row => favoriteCompetitions.includes(row.id)));
    competitions.forEach(row => { const key = competitionRegion(row); map.set(key, [...(map.get(key) ?? []), row]); });
    return [...map];
  }, [competitions, favoriteCompetitions]);
  return <View>{groups.map(([name, rows]) => <View key={name} style={styles.section}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded.includes(name) }} accessibilityLabel={`${name}, ${rows.length} competições`} onPress={() => setExpanded(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name])} style={[styles.heading, { backgroundColor: name === "Fixadas" ? colors.accent : colors.card }]}>
      <View style={[styles.regionIcon, { backgroundColor: colors.secondary }]}><Feather name={name === "Fixadas" ? "bookmark" : "globe"} size={21} color={name === "Fixadas" ? colors.primary : colors.foreground} /></View>
      <Text style={[styles.label, { color: colors.foreground }]}>{name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{rows.length}</Text><Feather name={expanded.includes(name) ? "chevron-up" : "chevron-down"} size={22} color={colors.mutedForeground} />
    </Pressable>
    {expanded.includes(name) && <View style={styles.content}>{rows.length ? rows.map(row => <CompetitionListItem key={row.id} id={row.id} name={row.name} region={row.serieName || "Valorant"} logoUrl={row.logoUrl} onPress={() => openCompetition(row.id)} />) : <Text style={[styles.empty, { color: colors.mutedForeground }]}>Toque na estrela de uma competição para fixá-la aqui.</Text>}</View>}
  </View>)}</View>;
}
const styles = StyleSheet.create({ section: { marginBottom: 12 }, heading: { borderRadius: 26, minHeight: 70, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 14 }, regionIcon: { width: 35, height: 35, borderRadius: 20, alignItems: "center", justifyContent: "center" }, label: { flex: 1, fontSize: 17 }, content: { paddingTop: 6 }, empty: { padding: 18, fontSize: 13, lineHeight: 20 } });

