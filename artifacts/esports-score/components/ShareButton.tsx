import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, Share, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

// Opens the system share sheet. Browsers without one get the text copied instead, with a check mark as feedback.
export function ShareButton({ message, label = "Compartilhar" }: { message: string; label?: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (Platform.OS !== "web") { await Share.share({ message }); return; }
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) { await nav.share({ text: message }); return; }
      await nav?.clipboard?.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Closing the share sheet throws on some platforms; nothing to do.
    }
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={copied ? "Copiado" : label} onPress={() => void share()} hitSlop={6} style={styles.button}>
    <Feather name={copied ? "check" : "share-2"} size={21} color={copied ? colors.positive : colors.foreground} />
  </Pressable>;
}

const styles = StyleSheet.create({ button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });
