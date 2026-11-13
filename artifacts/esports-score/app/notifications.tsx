import { Feather } from "@expo/vector-icons";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { EmptyState } from "@/components/MobileChrome";
import { font } from "@/constants/type";
import { useNotifications, type AppNotification } from "@/context/NotificationsContext";
import { useColors } from "@/hooks/useColors";
import { openMatch } from "@/lib/navigation";

const icon: Record<AppNotification["kind"], React.ComponentProps<typeof Feather>["name"]> = { match_started: "play-circle", match_finished: "flag", simulated: "bell" };

function when(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, markAllRead } = useNotifications();
  // Opening the list counts as reading it; the dots stay until the next visit.
  useEffect(() => () => { void markAllRead(); }, [markAllRead]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, 8) }}>
      <View style={styles.nav}><BackButton /><Text style={[styles.title, { color: colors.foreground }]}>Notificações</Text><View style={styles.spacer} /></View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 32 }}
        ListEmptyComponent={<EmptyState title="Nenhuma notificação ainda" description="Siga equipes para saber quando as partidas delas começam e terminam." />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" disabled={!item.match_id} onPress={() => item.match_id && openMatch(item.match_id)} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}>
            <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name={icon[item.kind]} size={18} color={colors.primary} /></View>
            <View style={styles.copy}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.rowBody, { color: colors.mutedForeground }]} numberOfLines={1}>{item.body}</Text>
              <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>{when(item.created_at)}</Text>
            </View>
            {!item.read_at ? <View accessibilityLabel="Não lida" style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, marginBottom: 12 },
  title: { fontSize: 17, fontFamily: font.bold },
  spacer: { width: 44 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, marginBottom: 8 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 14, lineHeight: 19, fontFamily: font.semibold },
  rowBody: { fontSize: 12, fontFamily: font.medium },
  rowTime: { fontSize: 11, fontFamily: font.regular },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
