import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Match } from "@/lib/data";

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
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, key: string, id: string) => setter((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
    return next;
  });
  const pinMatch = (match: Match) => {
    toggle(setMatches, "vant-matches", match.id);
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
      AsyncStorage.setItem("esports-favorites", JSON.stringify(next)).catch(() => undefined);
      return next;
    }),
    toggleFavorite: (id: string) => toggle(setTeams, "esports-favorites", id),
    toggleCompetition: (id: string) => toggle(setCompetitions, "vant-competitions", id),
    toggleMatch: (id: string) => toggle(setMatches, "vant-matches", id),
    pinMatch,
  }), [favoriteCompetitions, favoriteMatches, favoriteTeams, favoritesReady, savedMatches]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}
