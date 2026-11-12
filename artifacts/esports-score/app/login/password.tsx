import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { AuthField, AuthScreen, FormMessage, PrimaryButton } from "@/components/AuthScreen";
import { font } from "@/constants/type";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { authErrorMessage } from "@/lib/supabase";

export default function LoginPassword() {
  const colors = useColors();
  const { signIn } = useAuth();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    // On success the session changes and the root layout opens the app.
    try { await signIn(String(email), password); }
    catch (failure) { setError(authErrorMessage(failure)); setBusy(false); }
  };
  return (
    <AuthScreen
      back
      title="Agora, sua senha"
      subtitle={<>Não é você? <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontFamily: font.semibold }}>Trocar e-mail</Text></>}
      footer={<PrimaryButton label="Entrar" onPress={() => void submit()} busy={busy} disabled={!password} />}
    >
      <AuthField accessibilityLabel="Senha" placeholder="Senha" value={password} onChangeText={(value) => { setPassword(value); setError(null); }} secret textContentType="password" autoComplete="current-password" returnKeyType="go" onSubmitEditing={() => void submit()} autoFocus />
      <FormMessage text={error} />
    </AuthScreen>
  );
}
