import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { gameAssets } from "@/lib/assets";

export type GameFilter = "Valorant" | "CS2" | "League of Legends";
const items: { label: GameFilter; short: string; icon: "target" | "crosshair" | "zap"; key: string }[] = [
  { label: "Valorant", short: "V", icon: "target", key: "valorant" },
  { label: "CS2", short: "CS", icon: "crosshair", key: "cs2" },
  { label: "League of Legends", short: "LoL", icon: "zap", key: "lol" },
];

export function GameTabs({ selected, onChange }: { selected: GameFilter; onChange: (value: GameFilter) => void }) {
  const colors = useColors();
  return <View style={[styles.container, { borderBottomColor: colors.border }]}>{items.map((item) => {
    const active = selected === item.label;
    return <Pressable key={item.label} onPress={() => onChange(item.label)} style={styles.item}><View style={[styles.logo, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.primary : colors.border }]}><Feather name={item.icon} size={16} color={active ? colors.primary : colors.mutedForeground} /></View><Text style={[styles.label, { color: active ? colors.foreground : colors.mutedForeground }]}>{item.short}</Text>{active && <View style={[styles.indicator, { backgroundColor: colors.primary }]} />}</Pressable>;
  })}</View>;
}

export function gameAssetStatus(key: string) { return gameAssets[key]?.assetStatus ?? "missing"; }
const styles = StyleSheet.create({ container: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, marginBottom: 16 }, item: { minWidth: 78, alignItems: "center", paddingVertical: 8, marginRight: 8, position: "relative" }, logo: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" }, label: { fontSize: 12, fontWeight: "600", marginTop: 6 }, indicator: { position: "absolute", bottom: -1, height: 2, width: 30, borderRadius: 1 } });