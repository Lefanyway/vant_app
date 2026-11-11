import { AppLoading } from "@/components/AppLoading";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { CompetitionCard } from "@/components/CompetitionCard";
import { EmptyState } from "@/components/EmptyState";
import { GameIdentity } from "@/components/GameTabs";
import { font } from "@/constants/type";
import { useActiveScreen } from "@/hooks/useActiveScreen";
import { useColors } from "@/hooks/useColors";
import { errorMessage, fetchLiveMatches, fetchMatches, localDateKey } from "@/lib/api";
import type { Match } from "@/lib/data";
import { groupMatches } from "@/lib/matches";
import { openCompetition, openMatch } from "@/lib/navigation";

type StatusFilter = "all" | "live" | "finished";

const filters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "live", label: "Ao vivo" },
  { id: "finished", label: "Finalizadas" },
];

function shiftKey(key: string, days: number) {
  const next = new Date(`${key}T12:00:00`);
  next.setDate(next.getDate() + days);
  return localDateKey(next);
}

function dayLabel(key: string, todayKey: string) {
  const offset = Math.round((Date.parse(`${key}T12:00:00`) - Date.parse(`${todayKey}T12:00:00`)) / 86_400_000);
  if (offset === 0) return "Hoje";
  if (offset === -1) return "Ontem";
  if (offset === 1) return "Amanhã";
  return new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function Scoreboard({ showSearch = true, showIdentity = true }: { showSearch?: boolean; showIdentity?: boolean }) {
  const colors = useColors();
  const active = useActiveScreen();
  const queryClient = useQueryClient();
  const todayKey = localDateKey(new Date());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const matchesQuery = useQuery({
    queryKey: ["matches", "valorant", selectedDate],
    queryFn: ({ signal }) => fetchMatches("valorant", selectedDate, signal),
    staleTime: 60_000,
    refetchInterval: (query) => {
      if (!active || status === "live") return false;
      const rows = query.state.data as Match[] | undefined;
      return rows?.some((match) => match.status === "Live") ? 45_000 : false;
    },
  });
  const liveQuery = useQuery({
    queryKey: ["live", "valorant"],
    queryFn: ({ signal }) => fetchLiveMatches("valorant", signal),
    enabled: status === "live",
    staleTime: 20_000,
    refetchInterval: active && status === "live" ? 45_000 : false,
  });
  useEffect(() => {
    for (const days of [-1, 1]) {
      const key = shiftKey(selectedDate, days);
      void queryClient.prefetchQuery({ queryKey: ["matches", "valorant", key], queryFn: () => fetchMatches("valorant", key), staleTime: 60_000 });
    }
  }, [queryClient, selectedDate]);
  const rows = useMemo(() => {
    const dayRows = matchesQuery.data ?? [];
    const source = status === "live" ? (liveQuery.data ?? dayRows.filter((match) => match.status === "Live")) : dayRows;
    const needle = query.trim().toLowerCase();
    return source.filter((match) => {
      if (status === "finished" && match.status !== "Finished") return false;
      if (!needle) return true;
      return `${match.teamA.name} ${match.teamB.name} ${match.tournament}`.toLowerCase().includes(needle);
    });
  }, [liveQuery.data, matchesQuery.data, query, status]);
  const grouped = groupMatches(rows);
  const waiting = status === "live" ? liveQuery.isLoading && !liveQuery.data && !(matchesQuery.data ?? []).some((match) => match.status === "Live") : matchesQuery.isLoading && !matchesQuery.data;
  const failed = status === "live" ? liveQuery.isError && !liveQuery.data : matchesQuery.isError && !matchesQuery.data;
  const stale = status === "live" ? liveQuery.isError && Boolean(liveQuery.data) : matchesQuery.isError && Boolean(matchesQuery.data);
  const refresh = async () => {
    setRefreshing(true);
    try { await (status === "live" ? liveQuery.refetch() : matchesQuery.refetch()); }
    finally { setRefreshing(false); }
  };
  return (
    <View style={styles.fill}>
      {showSearch ? (
        <View style={styles.header}>
          <Text style={[styles.brand, { color: colors.foreground, fontFamily: font.bold }]}>VANT</Text>
          <View style={[styles.search, { backgroundColor: colors.card }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar partidas" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground, fontFamily: font.regular }]} autoCapitalize="none" autoCorrect={false} />
          </View>
        </View>
      ) : null}
      {showIdentity ? <GameIdentity /> : null}
      <View style={styles.dateRow}>
        <View style={[styles.datePill, { backgroundColor: colors.card }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dia anterior" onPress={() => setSelectedDate((current) => shiftKey(current, -1))} style={styles.dateButton}><Feather name="chevron-left" size={18} color={colors.primary} /></Pressable>
          <Text style={[styles.dateLabel, { color: colors.primary, fontFamily: font.bold }]}>{dayLabel(selectedDate, todayKey)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Próximo dia" onPress={() => setSelectedDate((current) => shiftKey(current, 1))} style={styles.dateButton}><Feather name="chevron-right" size={18} color={colors.primary} /></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir calendário" onPress={() => setCalendarOpen(true)} style={styles.dateButton}><Feather name="calendar" size={18} color={colors.foreground} /></Pressable>
      </View>
      <View style={styles.filters}>
        {filters.map((filter) => {
          const selected = status === filter.id;
          const live = filter.id === "live";
          const background = selected ? (live ? colors.live : colors.foreground) : colors.secondary;
          const text = selected ? (live ? "#FFFFFF" : colors.background) : colors.foreground;
          return (
            <Pressable key={filter.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setStatus(filter.id)} style={[styles.chip, { backgroundColor: background }]}>
              {live ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: selected ? "#FFFFFF" : colors.live }} /> : null}
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15} style={[styles.chipText, { color: text, fontFamily: font.semibold }]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {stale ? <Text style={[styles.stale, { color: colors.mutedForeground, fontFamily: font.medium }]}>Não foi possível atualizar. Mostrando dados salvos.</Text> : null}
      {waiting ? <AppLoading /> : failed ? (
        <EmptyState title={errorMessage(status === "live" ? liveQuery.error : matchesQuery.error, "Não foi possível carregar as partidas.")} action="Tentar de novo" onAction={() => { void refresh(); }} />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(group) => group.id ?? group.name}
          renderItem={({ item }) => (
            <CompetitionCard
              name={item.name}
              stage={item.stage}
              logoUrl={item.logoUrl}
              matches={item.matches}
              onMatchPress={(match: Match) => openMatch(match.id, match)}
              onOpen={item.id && !item.id.startsWith("unknown:") ? () => openCompetition(item.id!) : undefined}
            />
          )}
          ListEmptyComponent={<EmptyState title={status === "live" ? "Nenhuma partida ao vivo." : query.trim() ? "Nenhuma partida encontrada." : "Nenhuma partida neste dia."} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        />
      )}
      <Calendar visible={calendarOpen} selected={selectedDate} onClose={() => setCalendarOpen(false)} onSelect={(key) => { setSelectedDate(key); setCalendarOpen(false); }} />
    </View>
  );
}

function Calendar({ visible, selected, onClose, onSelect }: { visible: boolean; selected: string; onClose: () => void; onSelect: (key: string) => void }) {
  const colors = useColors();
  const cursor = new Date(`${selected}T12:00:00`);
  const [month, setMonth] = useState(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.dateButton}><Feather name="chevron-left" size={18} color={colors.foreground} /></Pressable>
            <Text style={[styles.monthLabel, { color: colors.foreground, fontFamily: font.bold }]}>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.dateButton}><Feather name="chevron-right" size={18} color={colors.foreground} /></Pressable>
          </View>
          <View style={styles.week}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => <Text key={`${label}-${index}`} style={[styles.weekday, { color: colors.mutedForeground }]}>{label}</Text>)}
          </View>
          <View style={styles.grid}>
            {days.map((date) => {
              const key = localDateKey(date);
              const inMonth = date.getMonth() === month.getMonth();
              const isSelected = key === selected;
              return (
                <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => onSelect(key)} style={[styles.day, isSelected && { backgroundColor: colors.foreground }]}>
                  <Text style={{ color: isSelected ? colors.background : inMonth ? colors.foreground : colors.mutedForeground, fontFamily: font.semibold }}>{date.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  brand: { fontSize: 18, letterSpacing: 1 },
  search: { flex: 1, minWidth: 0, height: 40, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 0 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 8 },
  datePill: { flex: 1, minHeight: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dateLabel: { fontSize: 15 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, flexDirection: "row", gap: 4 },
  chipText: { fontSize: 12 },
  stale: { fontSize: 12, marginBottom: 8 },
  list: { paddingBottom: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { fontSize: 16, textTransform: "capitalize" },
  week: { flexDirection: "row", marginTop: 8 },
  weekday: { flex: 1, textAlign: "center", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 22 },
});
