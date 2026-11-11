import { Pressable, StyleSheet, Text, View } from "react-native";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";

export function EmptyState({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: colors.mutedForeground, fontFamily: font.medium }]}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text style={[styles.actionText, { color: colors.primary, fontFamily: font.bold }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MatchSkeleton() {
  const colors = useColors();
  return (
    <View accessibilityLabel="Carregando partidas">
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.bone, { backgroundColor: colors.card }]} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 28 },
  title: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  actionText: { fontSize: 14 },
  bone: { height: 92, borderRadius: 16, marginBottom: 10 },
});
