import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type AppContextValue = {
  favoriteTeams: string[];
  toggleFavorite: (id: string) => void;
  notifications: { before30: boolean; before5: boolean; start: boolean; result: boolean; spoilerFree: boolean };
  toggleNotification: (key: keyof AppContextValue["notifications"]) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const defaultNotifications = { before30: true, before5: false, start: true, result: true, spoilerFree: true };

export function AppProvider({ children }: { children: ReactNode }) {
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(["loud", "furia", "t1"]);
  const [notifications, setNotifications] = useState(defaultNotifications);

  useEffect(() => {
    AsyncStorage.multiGet(["esports-favorites", "esports-notifications"]).then(([fav, prefs]) => {
      if (fav[1]) setFavoriteTeams(JSON.parse(fav[1]));
      if (prefs[1]) setNotifications({ ...defaultNotifications, ...JSON.parse(prefs[1]) });
    }).catch(() => undefined);
  }, []);

  const toggleFavorite = (id: string) => setFavoriteTeams((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    AsyncStorage.setItem("esports-favorites", JSON.stringify(next)).catch(() => undefined);
    return next;
  });
  const toggleNotification = (key: keyof typeof defaultNotifications) => setNotifications((current) => {
    const next = { ...current, [key]: !current[key] };
    AsyncStorage.setItem("esports-notifications", JSON.stringify(next)).catch(() => undefined);
    return next;
  });

  const value = useMemo(() => ({ favoriteTeams, toggleFavorite, notifications, toggleNotification }), [favoriteTeams, notifications]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}