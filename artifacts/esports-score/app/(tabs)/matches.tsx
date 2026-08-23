import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatchCard } from "@/components/MatchCard";
import { matches } from "@/lib/data";
import { useColors } from "@/hooks/useColors";
export default function Matches() { const colors = useColors(); const insets = useSafeAreaInsets(); return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: Math.max(insets.top, 18), paddingBottom: 100 }}><Text style={[styles.title, { color: colors.foreground }]}>All matches</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Every series on the board today.</Text><View style={{ marginTop: 22 }}>{matches.map((m) => <MatchCard key={m.id} match={m} onPress={() => router.push(`/match/${m.id}`)} />)}</View></ScrollView> }
const styles = StyleSheet.create({ screen: { flex: 1, paddingHorizontal: 16 }, title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.8 }, subtitle: { fontSize: 14, marginTop: 6 }, });