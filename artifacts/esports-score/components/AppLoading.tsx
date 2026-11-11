import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function AppLoading({ message = "Carregando partidas…" }: { message?: string }) {
  const colors = useColors();
  return <View accessibilityRole="progressbar" accessibilityLabel={message} accessibilityState={{ busy: true }} style={[styles.screen, { backgroundColor: colors.background }]}>
    <View style={styles.brand}>
      <Image source={require("../assets/generated/games/valorant-mark.png")} resizeMode="contain" style={styles.logo} />
      <Text style={[styles.name, { color: colors.foreground }]}>VANT</Text>
    </View>
    <View style={styles.status}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", padding: 24 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 42, height: 42 },
  name: { fontSize: 34, fontWeight: "800", letterSpacing: 2 },
  status: { marginTop: 40, alignItems: "center", gap: 12 },
  message: { fontSize: 12, textAlign: "center" },
});
