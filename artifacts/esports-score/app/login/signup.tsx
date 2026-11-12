import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AuthField, AuthScreen, FormMessage, isEmail, PrimaryButton, TextButton } from "@/components/AuthScreen";
import { useAuth } from "@/context/AuthContext";
import { authErrorMessage } from "@/lib/supabase";

export default function SignUp() {
  const { signUp } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(String(params.email ?? ""));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    if (!name.trim()) return setError("Digite seu nome.");
    if (!isEmail(email)) return setError("Digite um e-mail válido.");
    if (password.length < 6) return setError("Use uma senha com pelo menos 6 caracteres.");
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(name, email, password);
      // Without confirmation the new session opens the app on its own.
      if (needsConfirmation) { setSentTo(email.trim()); setBusy(false); }
    } catch (failure) { setError(authErrorMessage(failure)); setBusy(false); }
  };
  if (sentTo) return (
    <AuthScreen
      back
      title="Confirme seu e-mail"
      subtitle={`Enviamos um link para ${sentTo}. Abra o link e depois entre com sua senha.`}
      footer={<PrimaryButton label="Ir para o login" onPress={() => router.replace({ pathname: "/login/password", params: { email: sentTo } })} />}
    />
  );
  return (
    <AuthScreen
      back
      title="Criar sua conta"
      subtitle="Leva menos de um minuto."
      footer={<>
        <PrimaryButton label="Criar conta" onPress={() => void submit()} busy={busy} disabled={!name.trim() || !email.trim() || !password} />
        <TextButton label="Já tenho conta" onPress={() => router.back()} />
      </>}
    >
      <AuthField accessibilityLabel="Nome" placeholder="Nome" value={name} onChangeText={(value) => { setName(value); setError(null); }} autoCapitalize="words" autoCorrect={false} textContentType="name" autoComplete="name" maxLength={60} autoFocus />
      <AuthField accessibilityLabel="E-mail" placeholder="E-mail" value={email} onChangeText={(value) => { setEmail(value); setError(null); }} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
      <AuthField accessibilityLabel="Senha" placeholder="Senha (mínimo 6 caracteres)" value={password} onChangeText={(value) => { setPassword(value); setError(null); }} secret textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={() => void submit()} />
      <FormMessage text={error} />
    </AuthScreen>
  );
}
