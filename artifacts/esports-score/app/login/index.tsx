import { router } from "expo-router";
import { useState } from "react";
import { AuthField, AuthScreen, FormMessage, isEmail, PrimaryButton, TextButton } from "@/components/AuthScreen";

export default function LoginEmail() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const next = () => {
    if (!isEmail(email)) { setError("Digite um e-mail válido."); return; }
    setError(null);
    router.push({ pathname: "/login/password", params: { email: email.trim() } });
  };
  return (
    <AuthScreen
      logo
      title="Qual é o seu e-mail?"
      subtitle="Para salvar seus favoritos em qualquer aparelho."
      footer={<>
        <PrimaryButton label="Continuar" onPress={next} disabled={!email.trim()} />
        <TextButton label="Criar uma conta" onPress={() => router.push({ pathname: "/login/signup", params: { email: email.trim() } })} />
      </>}
    >
      <AuthField accessibilityLabel="E-mail" placeholder="E-mail" value={email} onChangeText={(value) => { setEmail(value); setError(null); }} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="next" onSubmitEditing={next} autoFocus />
      <FormMessage text={error} />
    </AuthScreen>
  );
}
