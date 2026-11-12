import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthField, FormMessage, PrimaryButton } from "@/components/AuthScreen";
import { BackButton } from "@/components/BackButton";
import { font } from "@/constants/type";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { authErrorMessage } from "@/lib/supabase";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";

export default function Profile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, profile, updateProfile, updatePassword, signOut } = useAuth();
  const email = session?.user.email ?? "";
  const name = profile?.display_name?.trim() || email.split("@")[0] || "Seu perfil";
  const [editing, setEditing] = useState<"name" | "password" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);

  const open = (mode: "name" | "password") => { setEditing(mode); setDraft(mode === "name" ? name : ""); setMessage(null); };
  const save = async () => {
    if (busy) return;
    if (editing === "password" && draft.length < 6) return setMessage({ text: "Use uma senha com pelo menos 6 caracteres.", tone: "error" });
    if (editing === "name" && !draft.trim()) return setMessage({ text: "Digite seu nome.", tone: "error" });
    setBusy(true);
    try {
      if (editing === "name") await updateProfile({ display_name: draft.trim().slice(0, 60) });
      else await updatePassword(draft);
      setMessage({ text: editing === "name" ? "Nome atualizado." : "Senha alterada.", tone: "info" });
      setEditing(null);
    } catch (failure) { setMessage({ text: authErrorMessage(failure), tone: "error" }); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 14), paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.nav}><BackButton /></View>

      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{initials(name)}</Text></View>
        <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{email}</Text>
        {editing !== "name" ? <Pressable accessibilityRole="button" onPress={() => open("name")} style={[styles.chip, { backgroundColor: colors.secondary }]}><Text style={[styles.chipText, { color: colors.foreground }]}>Editar perfil</Text></Pressable> : null}
      </View>

      {editing === "name" ? <View style={styles.form}>
        <AuthField accessibilityLabel="Nome" placeholder="Nome" value={draft} onChangeText={setDraft} autoCapitalize="words" maxLength={60} autoFocus onSubmitEditing={() => void save()} />
        <PrimaryButton label="Salvar nome" onPress={() => void save()} busy={busy} />
        <Pressable accessibilityRole="button" onPress={() => setEditing(null)} style={styles.cancel}><Text style={[styles.chipText, { color: colors.mutedForeground }]}>Cancelar</Text></Pressable>
      </View> : null}

      {message ? <View style={styles.message}><FormMessage text={message.text} tone={message.tone} /></View> : null}

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Preferências</Text>
      <View style={[styles.panel, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>Resultados das partidas salvas</Text>
          <Switch
            accessibilityLabel="Resultados das partidas salvas"
            value={profile?.notify_saved_results ?? true}
            onValueChange={(value) => { updateProfile({ notify_saved_results: value }).catch(() => setMessage({ text: "Não foi possível salvar a preferência.", tone: "error" })); }}
            trackColor={{ false: colors.secondary, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Conta</Text>
      <View style={[styles.panel, { backgroundColor: colors.card }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: editing === "password" }} onPress={() => editing === "password" ? setEditing(null) : open("password")} style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>Alterar senha</Text>
          <Feather name={editing === "password" ? "chevron-down" : "chevron-right"} size={18} color={colors.mutedForeground} />
        </Pressable>
        {editing === "password" ? <View style={styles.inlineForm}>
          <AuthField accessibilityLabel="Nova senha" placeholder="Nova senha" value={draft} onChangeText={setDraft} secret textContentType="newPassword" autoComplete="new-password" autoFocus onSubmitEditing={() => void save()} />
          <PrimaryButton label="Salvar senha" onPress={() => void save()} busy={busy} disabled={!draft} />
        </View> : null}
      </View>

      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}>
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
  identity: { alignItems: "center", marginTop: 16 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: font.bold },
  name: { fontSize: 22, fontFamily: font.bold, letterSpacing: -0.4, marginTop: 16, textAlign: "center" },
  email: { fontSize: 14, fontFamily: font.regular, marginTop: 4 },
  chip: { minHeight: 40, borderRadius: 20, paddingHorizontal: 18, justifyContent: "center", marginTop: 16 },
  chipText: { fontSize: 14, fontFamily: font.semibold },
  form: { marginTop: 20, gap: 10 },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  message: { marginTop: 14, alignItems: "center" },
  section: { fontSize: 13, fontFamily: font.semibold, marginTop: 32, marginBottom: 10, marginHorizontal: 4 },
  panel: { borderRadius: 20, paddingHorizontal: 18 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: font.medium },
  inlineForm: { gap: 10, paddingBottom: 16 },
  signOut: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 28 },
  signOutText: { fontSize: 15, fontFamily: font.semibold },
});
