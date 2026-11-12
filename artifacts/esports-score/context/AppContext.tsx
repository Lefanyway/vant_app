import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Match } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type FavoriteKind = "team" | "competition" | "match";
const storageKeys: Record<FavoriteKind, string> = { team: "esports-favorites", competition: "vant-competitions", match: "vant-matches" };

type AppContextValue = {
  favoriteTeams: string[];
  favoriteCompetitions: string[];
  favoriteMatches: string[];
  savedMatches: Match[];
  favoritesReady: boolean;
  migrateFavorite: (oldId: string, newId: string) => void;
  toggleFavorite: (id: string) => void;
  toggleCompetition: (id: string) => void;
  toggleMatch: (id: string) => void;
  pinMatch: (match: Match) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function storedIds(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function storedMatches(value: string | null): Match[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Match => Boolean(item) && typeof item === "object" && typeof (item as Match).id === "string" && typeof (item as Match).teamA?.name === "string");
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [favoriteTeams, setTeams] = useState<string[]>([]);
  const [favoriteCompetitions, setCompetitions] = useState<string[]>([]);
  const [favoriteMatches, setMatches] = useState<string[]>([]);
  const [savedMatches, setSavedMatches] = useState<Match[]>([]);
  const [favoritesReady, setReady] = useState(false);
  const userId = useAuth().session?.user.id;
  const userRef = useRef(userId);
  useEffect(() => {
    const previous = userRef.current;
    userRef.current = userId;
    // Signing out leaves nothing of that account on the phone for the next one to inherit.
    if (previous && !userId) {
      setTeams([]); setCompetitions([]); setMatches([]); setSavedMatches([]);
      AsyncStorage.multiRemove([...Object.values(storageKeys), "vant-match-cards"]).catch(() => undefined);
    }
  }, [userId]);
  // Every change is saved on the phone first and then in the signed-in account.
  const remote = (kind: FavoriteKind, id: string, saved: boolean) => {
    const user = userRef.current;
    if (!user) return;
    const request = saved
      ? supabase.from("favorites").upsert({ user_id: user, kind, entity_id: id }, { onConflict: "user_id,kind,entity_id", ignoreDuplicates: true })
      : supabase.from("favorites").delete().match({ user_id: user, kind, entity_id: id });
    void Promise.resolve(request).catch(() => undefined);
  };
  useEffect(() => {
    let active = true;
    AsyncStorage.multiGet(["esports-favorites", "vant-competitions", "vant-matches", "vant-match-cards"])
      .then((values) => {
        if (!active) return;
        setTeams(storedIds(values[0][1]));
        setCompetitions(storedIds(values[1][1]));
        setMatches(storedIds(values[2][1]));
        setSavedMatches(storedMatches(values[3][1]));
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  // After sign-in, the account's favorites join the ones on this phone, and the phone's go up to the account.
  useEffect(() => {
    if (!userId || !favoritesReady) return;
    let active = true;
    supabase.from("favorites").select("kind, entity_id").then(({ data, error }) => {
      if (!active || error || !data) return;
      const merge = (kind: FavoriteKind, setter: React.Dispatch<React.SetStateAction<string[]>>) => setter((local) => {
        const account = data.filter((row) => row.kind === kind).map((row) => row.entity_id as string);
        const missing = local.filter((id) => !account.includes(id));
        if (missing.length) void Promise.resolve(supabase.from("favorites").upsert(missing.map((id) => ({ user_id: userId, kind, entity_id: id })), { onConflict: "user_id,kind,entity_id", ignoreDuplicates: true })).catch(() => undefined);
        const next = [...new Set([...local, ...account])];
        AsyncStorage.setItem(storageKeys[kind], JSON.stringify(next)).catch(() => undefined);
        return next;
      });
      merge("team", setTeams);
      merge("competition", setCompetitions);
      merge("match", setMatches);
    });
    return () => { active = false; };
  }, [userId, favoritesReady]);
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, kind: FavoriteKind, id: string) => setter((current) => {
    const saved = !current.includes(id);
    const next = saved ? [...current, id] : current.filter((item) => item !== id);
    AsyncStorage.setItem(storageKeys[kind], JSON.stringify(next)).catch(() => undefined);
    remote(kind, id, saved);
    return next;
  });
  const pinMatch = (match: Match) => {
    toggle(setMatches, "match", match.id);
    setSavedMatches((current) => {
      const next = current.some((item) => item.id === match.id) ? current.filter((item) => item.id !== match.id) : [match, ...current];
      AsyncStorage.setItem("vant-match-cards", JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };
  const value = useMemo(() => ({
    favoriteTeams,
    favoriteCompetitions,
    favoriteMatches,
    savedMatches,
    favoritesReady,
    migrateFavorite: (oldId: string, newId: string) => setTeams(current => {
      if (oldId === newId || !current.includes(oldId)) return current;
      const next = [...new Set(current.map(id => id === oldId ? newId : id))];
      AsyncStorage.setItem(storageKeys.team, JSON.stringify(next)).catch(() => undefined);
      remote("team", oldId, false);
      remote("team", newId, true);
      return next;
    }),
    toggleFavorite: (id: string) => toggle(setTeams, "team", id),
    toggleCompetition: (id: string) => toggle(setCompetitions, "competition", id),
    toggleMatch: (id: string) => toggle(setMatches, "match", id),
    pinMatch,
  }), [favoriteCompetitions, favoriteMatches, favoriteTeams, favoritesReady, savedMatches]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}
