import { Feather, Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ListSkeleton } from "@/components/MobileChrome";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchCatalogPage } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";

// Pick favorites from a list: tap the star on each one, or search to narrow it down.
export default function AddFavorites() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<"team" | "competition">(params.kind === "competition" ? "competition" : "team");
  const { favoriteTeams, favoriteCompetitions = [], toggleFavorite, toggleCompetition } = useApp();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const list = useInfiniteQuery({
    queryKey: ["catalog", kind, debounced], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchCatalogPage(kind, pageParam, debounced, signal),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined,
    staleTime: 10 * 60_000, placeholderData: keepPreviousData,
  });
  const rows = [...new Map((list.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values()];
  const saved = kind === "team" ? favoriteTeams : favoriteCompetitions;
  const toggle = kind === "team" ? toggleFavorite : toggleCompetition;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={goBackOrHome} style={styles.back}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Adicionar favoritos</Text>
        <Pressable accessibilityRole="button" onPress={goBackOrHome} style={styles.done}><Text style={[styles.doneText, { color: colors.primary }]}>Pronto</Text></Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: colors.card }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput value={query} onChangeText={setQuery} placeholder={kind === "team" ? "Pesquisar equipes" : "Pesquisar competições"} placeholderTextColor={colors.mutedForeground} autoCorrect={false} returnKeyType="search" accessibilityLabel="Pesquisar" style={[styles.input, { color: colors.foreground }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
        {query ? <Pressable accessibilityLabel="Limpar pesquisa" onPress={() => setQuery("")} hitSlop={8}><Feather name="x" size={17} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      <View style={[styles.segment, { backgroundColor: colors.card }]}>
        {(["team", "competition"] as const).map((key) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: kind === key }} onPress={() => setKind(key)} style={[styles.segmentItem, kind === key && { backgroundColor: colors.secondary }]}><Text style={[styles.segmentText, { color: kind === key ? colors.foreground : colors.mutedForeground }]}>{key === "team" ? "Equipes" : "Competições"}</Text></Pressable>)}
      </View>
    </View>
    <FlatList data={rows} keyExtractor={(row) => row.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 + insets.bottom }}
      onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }} onEndReachedThreshold={0.5}
      ListEmptyComponent={list.isLoading ? <ListSkeleton /> : list.isError ? <EmptyState title="Não foi possível carregar" onRetry={() => void list.refetch()} /> : <EmptyState title="Nada encontrado" description="Tente outro nome." />}
      ListFooterComponent={list.isFetchingNextPage ? <ListSkeleton count={1} /> : undefined}
      renderItem={({ item }) => {
        const on = saved.includes(item.id);
        return <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${on ? "Deixar de seguir" : "Seguir"} ${item.name}`} onPress={() => toggle(item.id)} style={[styles.row, { backgroundColor: colors.card }]}>
          <ResolvedLogo type={kind} entityId={item.id} name={item.name} logoUrl={item.logoUrl} size={34} />
          <View style={styles.copy}><Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{item.name}</Text><Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>{item.countryName || item.season || "Valorant"}</Text></View>
          <Ionicons name={on ? "star" : "star-outline"} size={22} color={on ? colors.primary : colors.mutedForeground} />
        </Pressable>;
      }}
    />
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 10, paddingBottom: 10, gap: 10 },
  top: { flexDirection: "row", alignItems: "center" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  done: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  doneText: { fontSize: 15, fontWeight: "700" },
  search: { height: 42, borderRadius: 21, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 0 },
  segment: { flexDirection: "row", borderRadius: 20, padding: 3 },
  segmentItem: { flex: 1, minHeight: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 13, fontWeight: "600" },
  row: { minHeight: 60, borderRadius: 14, paddingHorizontal: 14, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
});
