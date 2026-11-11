import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ComingSoonGames } from "@/components/GameTabs";
import { useColors } from "@/hooks/useColors";

export default function Profile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 18), paddingBottom: 100 }}>
      <Text style={[styles.title, { color: colors.foreground }]}>VANT</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Suas equipes e partidas favoritas ficam salvas neste dispositivo.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/following")} style={[styles.button, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.buttonText, { color: colors.foreground }]}>Abrir favoritos</Text>
      </Pressable>
      <ComingSoonGames />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.8 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 16 },
  button: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 24, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: "700" },
});
