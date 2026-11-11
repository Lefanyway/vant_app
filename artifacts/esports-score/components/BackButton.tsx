import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { goBackOrHome } from "@/lib/navigation";

export function BackButton() {
  const colors = useColors();
  return (
    <Pressable testID="back-button" accessibilityRole="button" accessibilityLabel="Voltar" onPress={goBackOrHome} hitSlop={12} style={styles.button}>
      <Feather name="arrow-left" size={21} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
