import { Image, StyleSheet, Text, View } from "react-native";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";

const mark = require("../assets/generated/games/valorant-mark.png");

export function GameIdentity() {
  const colors = useColors();
  return (
    <View style={styles.row} accessibilityRole="header">
      <Image source={mark} resizeMode="contain" accessibilityLabel="Símbolo do Valorant" style={styles.mark} />
      <Text maxFontSizeMultiplier={1.3} style={[styles.name, { color: colors.foreground, fontFamily: font.bold }]}>Valorant</Text>
    </View>
  );
}

export function ComingSoonGames() {
  const colors = useColors();
  const games = ["CS2", "League of Legends"];
  return (
    <View style={[styles.soonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.soonTitle, { color: colors.foreground, fontFamily: font.bold }]}>Outros jogos</Text>
      {games.map((game) => (
        <View key={game} style={styles.soonRow}>
          <Text style={[styles.soonName, { color: colors.foreground, fontFamily: font.semibold }]}>{game}</Text>
          <Text style={[styles.soonLabel, { color: colors.mutedForeground, fontFamily: font.medium }]}>Em breve</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 28, height: 28 },
  name: { fontSize: 16 },
  soonCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 28 },
  soonTitle: { fontSize: 13, marginBottom: 8 },
  soonRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  soonName: { fontSize: 15 },
  soonLabel: { fontSize: 13 },
});
