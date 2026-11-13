import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";

const steps = [
  { title: "1. Força de cada time (Elo)", text: "Todo time começa com 1500 pontos. Quem vence ganha pontos e quem perde cede, mais quando a vitória é uma surpresa. Assim o Elo resume o histórico inteiro num número." },
  { title: "2. Os fatores de cada partida", text: "Para cada jogo o modelo compara os dois times: diferença de Elo, forma nas últimas partidas, experiência (quantos jogos já fizeram), confrontos diretos e dias de descanso." },
  { title: "3. A chance de vitória", text: "Uma regressão logística dá um peso a cada fator, aprendido com milhares de partidas passadas, e transforma a soma em uma porcentagem entre 0 e 100%." },
  { title: "4. Como medimos se é bom", text: "Cada partida do teste é prevista só com o que aconteceu antes dela, como seria na vida real. O resultado é comparado com usar só o Elo e com chutar 50%." },
  { title: "5. Atualização", text: "O modelo é treinado de novo duas vezes por dia com os resultados mais recentes. O \"Por quê?\" de cada jogo mostra quais fatores mais pesaram." },
];

// "Como funciona": the model in five plain steps, collapsed until asked for.
export function ModelExplainer() {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return <View style={[styles.card, { backgroundColor: colors.card }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.header}>
      <Feather name="info" size={18} color={colors.primary} />
      <Text style={[styles.title, { color: colors.foreground }]}>Como as previsões são calculadas</Text>
      <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
    </Pressable>
    {open ? <View style={styles.body}>
      {steps.map((step) => <View key={step.title} style={styles.step}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
        <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{step.text}</Text>
      </View>)}
      <Text style={[styles.note, { color: colors.mutedForeground }]}>É uma estimativa estatística, não uma certeza: jogos equilibrados podem ir para qualquer lado.</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 16, marginTop: 12 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 14, fontFamily: font.semibold },
  body: { gap: 14, paddingBottom: 16 },
  step: { gap: 4 },
  stepTitle: { fontSize: 14, fontFamily: font.semibold },
  stepText: { fontSize: 13, lineHeight: 19, fontFamily: font.regular },
  note: { fontSize: 12, lineHeight: 17, fontFamily: font.medium, fontStyle: "italic" },
});
