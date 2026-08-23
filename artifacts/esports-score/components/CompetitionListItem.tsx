import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function CompetitionListItem({ name, region }: { name: string; region: string }) {
  const colors = useColors();
  return <Pressable style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}><View style={[styles.logo, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Feather name="flag" size={16} color={colors.mutedForeground} /></View><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{name}</Text><Text style={[styles.region, { color: colors.mutedForeground }]}>{region}</Text></View><Feather name="bookmark" size={18} color={colors.mutedForeground} /></Pressable>;
}

const styles = StyleSheet.create({ row: { minHeight: 62, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", marginBottom: 8 }, logo: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, marginLeft: 12 }, name: { fontSize: 14, fontWeight: "600" }, region: { fontSize: 12, marginTop: 4 } });