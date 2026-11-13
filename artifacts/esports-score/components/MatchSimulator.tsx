import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PredictionWhy } from "@/components/PredictionWhy";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { fetchCatalogPage, type ApiSearchResult } from "@/lib/api";
import { confidence, simulate, type Coefficients } from "@/lib/insights";

type Choice = Pick<ApiSearchResult, "id" | "name" | "logoUrl">;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const noWebOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

// "What if": any two teams, scored by the same model as a real BO3 between them today.
export function MatchSimulator({ coefficients }: { coefficients: Coefficients }) {
  const colors = useColors();
  const [teams, setTeams] = useState<[Choice | null, Choice | null]>([null, null]);
  const [choosing, setChoosing] = useState<0 | 1 | null>(null);
  const [a, b] = teams;
  const result = useQuery({ queryKey: ["simulate", a?.id, b?.id], queryFn: () => simulate(a!.id, b!.id, coefficients), enabled: Boolean(a && b && a.id !== b.id), staleTime: 10 * 60_000 });
  const chance = result.data?.chance;
  return <View style={[styles.card, { backgroundColor: colors.card }]}>
    <View style={styles.slots}>
      {teams.map((team, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={team ? `Trocar ${team.name}` : `Escolher o ${index ? "segundo" : "primeiro"} time`} onPress={() => setChoosing(index as 0 | 1)} style={[styles.slot, { backgroundColor: colors.secondary }]}>
        {team ? <ResolvedLogo type="team" name={team.name} entityId={team.id} logoUrl={team.logoUrl} size={44} /> : <View style={[styles.plus, { borderColor: colors.primary }]}><Feather name="plus" size={20} color={colors.primary} /></View>}
        <Text numberOfLines={1} style={[styles.slotName, { color: team ? colors.foreground : colors.primary }]}>{team?.name ?? "Escolher time"}</Text>
        {chance !== undefined ? <Text style={[styles.slotChance, { color: (index ? 1 - chance : chance) >= 0.5 ? colors.primary : colors.mutedForeground }]}>{pct(index ? 1 - chance : chance)}</Text> : null}
      </Pressable>)}
    </View>
    {a && b && a.id === b.id ? <Text style={[styles.note, { color: colors.mutedForeground }]}>Escolha dois times diferentes.</Text>
      : !a || !b ? <Text style={[styles.note, { color: colors.mutedForeground }]}>Escolha dois times para ver quem o modelo aponta como favorito numa série melhor de 3.</Text>
      : result.isLoading ? <Text style={[styles.note, { color: colors.mutedForeground }]}>Calculando…</Text>
      : result.isError || !result.data ? <Pressable onPress={() => void result.refetch()}><Text style={[styles.note, { color: colors.primary }]}>Não foi possível calcular. Tocar para tentar de novo.</Text></Pressable>
      : <View style={styles.result}>
        <View style={[styles.bar, { backgroundColor: colors.secondary }]}><View style={[styles.fill, { width: `${Math.round(result.data.chance * 100)}%`, backgroundColor: colors.primary }]} /></View>
        <Text style={[styles.verdict, { color: colors.foreground }]}>{confidence(result.data.chance)}{Math.abs(result.data.chance - 0.5) >= 0.05 ? `: ${result.data.chance >= 0.5 ? a.name : b.name}` : ""}</Text>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>Elo {Math.round(result.data.elo[0])} × {Math.round(result.data.elo[1])} · {result.data.meetings ? `${result.data.meetings} confronto${result.data.meetings > 1 ? "s" : ""} anterior${result.data.meetings > 1 ? "es" : ""}` : "nunca se enfrentaram"}</Text>
        <PredictionWhy features={result.data.features} coefficients={coefficients} home={a.name} away={b.name} />
      </View>}
    {a || b ? <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={() => setTeams([null, null])} style={[styles.action, { backgroundColor: colors.secondary }]}><Feather name="rotate-ccw" size={15} color={colors.foreground} /><Text style={[styles.actionText, { color: colors.foreground }]}>Nova simulação</Text></Pressable>
      {a && b ? <Pressable accessibilityRole="button" accessibilityLabel="Inverter os times" onPress={() => setTeams([b, a])} style={[styles.action, { backgroundColor: colors.secondary }]}><Feather name="repeat" size={15} color={colors.foreground} /><Text style={[styles.actionText, { color: colors.foreground }]}>Inverter</Text></Pressable> : null}
    </View> : null}
    <TeamPicker visible={choosing !== null} onClose={() => setChoosing(null)} onPick={(team) => { setTeams((current) => choosing === 0 ? [team, current[1]] : [current[0], team]); setChoosing(null); }} />
  </View>;
}

function TeamPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (team: Choice) => void }) {
  const colors = useColors();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(text.trim()), 300); return () => clearTimeout(timer); }, [text]);
  const search = useQuery({ queryKey: ["catalog-team-pick", debounced], queryFn: ({ signal }) => fetchCatalogPage("team", 1, debounced, signal), enabled: visible, staleTime: 10 * 60_000 });
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
        <View style={[styles.search, { backgroundColor: colors.secondary }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput autoFocus value={text} onChangeText={setText} placeholder="Buscar time, ex.: LOUD" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} style={[styles.input, { color: colors.foreground }, noWebOutline]} />
        </View>
        <FlatList data={search.data?.items ?? []} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}
          ListEmptyComponent={<Text style={[styles.note, { color: colors.mutedForeground, padding: 16 }]}>{search.isFetching ? "Buscando…" : "Nenhum time encontrado."}</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { onPick(item); setText(""); }} style={styles.option}>
            <ResolvedLogo type="team" name={item.name} entityId={item.id} logoUrl={item.logoUrl} size={32} />
            <Text numberOfLines={1} style={[styles.optionName, { color: colors.foreground }]}>{item.name}</Text>
          </Pressable>} />
      </Pressable>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, gap: 14 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 10 },
  action: { minHeight: 40, borderRadius: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  actionText: { fontSize: 14, fontFamily: font.semibold },
  slots: { flexDirection: "row", gap: 10 },
  slot: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", gap: 8 },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  slotName: { fontSize: 13, fontFamily: font.semibold, maxWidth: "100%" },
  slotChance: { fontSize: 22, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  note: { fontSize: 12, lineHeight: 17, fontFamily: font.medium, textAlign: "center" },
  result: { gap: 12 },
  bar: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  verdict: { fontSize: 15, fontFamily: font.bold, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  sheet: { borderRadius: 22, padding: 12, gap: 8, width: "100%", maxWidth: 440, alignSelf: "center" },
  search: { height: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 0 },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  optionName: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: font.semibold },
});
