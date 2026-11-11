import { Ionicons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import { EmptyState } from "@/components/MobileChrome";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchCatalogPage, type ApiSearchResult } from "@/lib/api";
import { openCompetition } from "@/lib/navigation";

// The pill already shows focus; the browser's own outline would draw a box inside it.
const noWebOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

type Filter = "all" | "team" | "competition";
const filters: { key: Filter; name: string }[] = [{ key: "all", name: "Tudo" }, { key: "team", name: "Equipes" }, { key: "competition", name: "Competições" }];

// The second line tells apart teams and leagues with similar names: sigla and país, or the latest season.
function subtitle(item: ApiSearchResult) {
  const acronym = item.acronym && item.acronym.toLowerCase() !== item.name.toLowerCase() ? item.acronym : undefined;
  const parts = item.type === "team" ? ["Equipe", acronym, item.countryName] : ["Competição", item.season];
  return parts.filter(Boolean).join(" · ");
}

export default function Search() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { favoriteTeams, favoriteCompetitions = [], toggleFavorite, toggleCompetition } = useApp();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const searchQuery = useInfiniteQuery({
    queryKey: ["catalog", filter, debounced], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchCatalogPage(filter, pageParam, debounced, signal),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined,
    staleTime: 10 * 60_000,
    // Keep the last results on screen while the next keystroke is searched, instead of flashing an empty list.
    placeholderData: keepPreviousData,
  });
  const pending = searchQuery.isLoading;
  const rows = [...new Map((searchQuery.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()];
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.card }}>
    <View style={[styles.header, { backgroundColor: colors.secondary, paddingTop: insets.top + 8 }]}>
      <View style={styles.top}><Pressable accessibilityLabel="Fechar busca" onPress={() => router.navigate('/')} style={styles.close}><Feather name="x" size={25} color={colors.foreground} /></Pressable><View style={[styles.search, { backgroundColor: colors.card }]}><Feather name="search" size={23} color={colors.foreground} /><TextInput value={query} onChangeText={setQuery} placeholder="Equipe, sigla ou competição" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }, noWebOutline]} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />{query.length > 0 ? <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery("")} style={styles.clear}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}</View></View>
      <View style={styles.filters}>{filters.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: filter === item.key }} onPress={() => setFilter(item.key)} style={[styles.chip, { backgroundColor: filter === item.key ? "#ECEDEF" : colors.background }]}><Text style={{ color: filter === item.key ? "#181E20" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{item.name}</Text></Pressable>)}</View>
    </View>
    <FlatList data={rows} keyExtractor={row => row.type + row.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      onEndReached={() => { if (searchQuery.hasNextPage && !searchQuery.isFetchingNextPage && !searchQuery.isFetchNextPageError) void searchQuery.fetchNextPage(); }} onEndReachedThreshold={0.5}
      ListFooterComponent={searchQuery.isFetchingNextPage ? <Text style={[styles.caption, { color: colors.mutedForeground }]}>Carregando…</Text> : searchQuery.isFetchNextPageError ? <EmptyState title="Não foi possível carregar mais" onRetry={() => void searchQuery.fetchNextPage()} /> : undefined}
      ListHeaderComponent={<Text style={[styles.caption, { color: colors.foreground }]}>{searchQuery.isFetching && !pending ? "Buscando…" : debounced ? `Resultados para “${debounced}”` : "Em destaque agora"}</Text>}
      ListEmptyComponent={pending ? <Text style={[styles.caption, { color: colors.mutedForeground }]}>Buscando…</Text> : searchQuery.isError ? <EmptyState title="Não foi possível buscar" onRetry={() => void searchQuery.refetch()} /> : debounced ? <EmptyState title={`Nenhum resultado para “${debounced}”`} description="Confira a grafia ou tente a sigla da equipe, como TL ou FNC." /> : <EmptyState title="Nada em destaque agora" description="Digite o nome ou a sigla de uma equipe ou competição." />}
      renderItem={({ item }) => { const saved = item.type === "team" ? favoriteTeams.includes(item.id) : favoriteCompetitions.includes(item.id); return <View style={styles.result}><Pressable testID={item.type === "team" ? `team-link-${item.id}` : `competition-link-${item.id}`} accessibilityRole="link" accessibilityLabel={`Abrir ${item.name}`} onPress={() => item.type === "team" ? router.push(`/teams/${encodeURIComponent(item.id)}`) : openCompetition(item.id)} style={styles.link}><ResolvedLogo type={item.type === "team" ? "team" : "competition"} name={item.name} entityId={item.id} logoUrl={item.logoUrl} size={42} /><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={2}>{subtitle(item)}</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`${saved ? "Desfavoritar" : "Favoritar"} ${item.name}`} accessibilityState={{ selected: saved }} onPress={() => item.type === "team" ? toggleFavorite(item.id) : toggleCompetition?.(item.id)} style={styles.star}><Ionicons name={saved ? "star" : "star-outline"} size={23} color={saved ? colors.primary : colors.mutedForeground} /></Pressable></View>; }}
    />
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ header: { paddingHorizontal: 10, paddingBottom: 12 }, top: { flexDirection: "row", alignItems: "center", gap: 8 }, close: { width: 38, height: 44, alignItems: "center", justifyContent: "center" }, search: { flex: 1, minWidth: 0, height: 44, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }, input: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 0 }, clear: { width: 36, height: 44, alignItems: "center", justifyContent: "center" }, filters: { flexDirection: "row", gap: 8, marginTop: 12 }, chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 24, justifyContent: "center" }, caption: { fontSize: 14, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }, result: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 }, link: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }, copy: { flex: 1, minWidth: 0 }, name: { fontSize: 16, lineHeight: 22 }, meta: { fontSize: 12, marginTop: 4 }, star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });

