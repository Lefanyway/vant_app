import { Feather } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { goBackOrHome } from "@/lib/navigation";

const mark = require("../assets/generated/games/valorant-mark.png");
// The field draws its own focus border; the browser outline would add a second box.
const noWebOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

// One question per screen: a title, its field and one main action at the bottom.
// The keyboard pushes the bottom action up on both platforms: Android draws edge to edge, so the window never resizes on its own.
export function AuthScreen({ title, subtitle, back = false, logo = false, children, footer }: { title: string; subtitle?: ReactNode; back?: boolean; logo?: boolean; children?: ReactNode; footer: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" enabled={Platform.OS !== "web"} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
        <View style={styles.top}>
          {back ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={goBackOrHome} hitSlop={8} style={styles.back}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable> : null}
        </View>
        {logo ? <Image source={mark} resizeMode="contain" accessibilityLabel="VANT" style={styles.logo} /> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, marginTop: logo ? 24 : 56 }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthField({ secret, style, ...props }: TextInputProps & { secret?: boolean }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.field, { backgroundColor: colors.card, borderColor: focused ? colors.primary : "transparent" }]}>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={secret && !visible}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        style={[styles.input, { color: colors.foreground }, noWebOutline, style]}
      />
      {secret ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Esconder senha" : "Mostrar senha"} onPress={() => setVisible((value) => !value)} style={styles.eye}><Feather name={visible ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} /></Pressable> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy = false, disabled = false }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const colors = useColors();
  const off = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: off, busy }} disabled={off} onPress={onPress} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{label}</Text>}
    </Pressable>
  );
}

export function TextButton({ label, onPress, tone = "default" }: { label: string; onPress: () => void; tone?: "default" | "accent" }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={styles.textButton}>
      <Text style={[styles.textButtonLabel, { color: tone === "accent" ? colors.primary : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function FormMessage({ text, tone = "error" }: { text?: string | null; tone?: "error" | "info" }) {
  const colors = useColors();
  if (!text) return null;
  return <Text accessibilityLiveRegion="polite" style={[styles.message, { color: tone === "error" ? colors.destructive : colors.mutedForeground }]}>{text}</Text>;
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24 },
  top: { minHeight: 44, flexDirection: "row" },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  logo: { width: 32, height: 32, marginTop: 40 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: font.bold, letterSpacing: -0.9 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 10, fontFamily: font.regular },
  body: { marginTop: 32, gap: 12 },
  footer: { marginTop: "auto", paddingTop: 32, alignItems: "center", gap: 6 },
  field: { minHeight: 58, borderRadius: 16, borderWidth: 1.5, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 6 },
  input: { flex: 1, minWidth: 0, minHeight: 56, fontSize: 17, fontFamily: font.medium, paddingVertical: 0 },
  eye: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  primary: { alignSelf: "stretch", height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontFamily: font.bold },
  textButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8 },
  textButtonLabel: { fontSize: 15, fontFamily: font.semibold },
  message: { fontSize: 14, lineHeight: 20, fontFamily: font.medium },
});
