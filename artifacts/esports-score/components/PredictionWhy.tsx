import { StyleSheet, Text, View } from "react-native";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { explain, type Coefficients, type Features } from "@/lib/insights";

// Why the model leans one way: each factor, which team it helps, and how much next to the strongest one.
export function PredictionWhy({ features, coefficients, home, away }: { features: Features; coefficients: Coefficients; home: string; away: string }) {
  const colors = useColors();
  const reasons = explain(features, coefficients);
  if (!reasons.length) return <Text style={[styles.empty, { color: colors.mutedForeground }]}>Os dois times chegam muito parecidos em todos os fatores.</Text>;
  const strongest = Math.abs(reasons[0].weight);
  return <View style={styles.list}>
    {reasons.map((reason) => <View key={reason.label} style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.foreground }]}>{reason.label}</Text>
        <Text numberOfLines={1} style={[styles.side, { color: colors.mutedForeground }]}>a favor de {reason.weight > 0 ? home : away}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.secondary }]}>
        <View style={[styles.fill, { width: `${Math.max(8, Math.round(Math.abs(reason.weight) / strongest * 100))}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { width: 140 },
  label: { fontSize: 13, fontFamily: font.semibold },
  side: { fontSize: 11, fontFamily: font.medium, marginTop: 1 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  empty: { fontSize: 12, fontFamily: font.medium, lineHeight: 17 },
});
