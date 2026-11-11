import { Ionicons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ResolvedLogo } from "./ResolvedLogo";
export function CompetitionListItem({ id, name, region, logoUrl, onPress }: { id: string; name: string; region: string; logoUrl?: string; onPress: () => void }) {
  const colors = useColors();
  const { favoriteCompetitions = [], toggleCompetition } = useApp();
  const saved = favoriteCompetitions.includes(id);
  return <View style={[styles.row, { backgroundColor: colors.card }]}>
    <Pressable testID={`competition-link-${id}`} accessibilityRole="link" accessibilityLabel={`Abrir ${name}`} onPress={onPress} style={({ pressed }) => [styles.link, { opacity: pressed ? .65 : 1 }]}>
      <ResolvedLogo type="competition" entityId={id} name={name} logoUrl={logoUrl} size={36} /><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>{name}</Text><Text style={[styles.region, { color: colors.mutedForeground }]}>{region}</Text></View>
    </Pressable>
    <Pressable accessibilityLabel={`${saved ? "Desfavoritar" : "Favoritar"} ${name}`} accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={() => toggleCompetition?.(id)} style={styles.star}><Ionicons name={saved ? "star" : "star-outline"} size={22} color={saved ? colors.primary : colors.mutedForeground} /></Pressable>
  </View>;
}
const styles = StyleSheet.create({ row: { minHeight: 70, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 10 }, link: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }, copy: { flex: 1, minWidth: 0 }, name: { fontSize: 15, lineHeight: 20 }, region: { fontSize: 12, marginTop: 4 }, star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });

