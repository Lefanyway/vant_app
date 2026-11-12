import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type AppNotification = { id: number; match_id: string | null; kind: "match_started" | "match_finished" | "simulated"; title: string; body: string; created_at: string; read_at: string | null };

type NotificationsValue = {
  items: AppNotification[];
  unread: number;
  markAllRead: () => Promise<void>;
  simulate: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);
const native = Platform.OS !== "web";

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function ensurePermission() {
  if (!native) return false;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("partidas", { name: "Partidas", importance: Notifications.AndroidImportance.HIGH });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// The database writes a row when a followed match starts or ends; Realtime brings it here and the phone shows it.
// This works in Expo Go while the app is open or in the background; push with the app closed needs a development build.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const userId = useAuth().session?.user.id;
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!userId) { setItems([]); return; }
    let active = true;
    void ensurePermission().catch(() => false);
    supabase.from("notifications").select("id, match_id, kind, title, body, created_at, read_at").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (active && data) setItems(data as AppNotification[]); });
    const channel = supabase.channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, ({ new: row }) => {
        const item = row as AppNotification;
        setItems((current) => [item, ...current.filter((other) => other.id !== item.id)].slice(0, 50));
        if (native) void Notifications.scheduleNotificationAsync({ content: { title: item.title, body: item.body, data: { matchId: item.match_id } }, trigger: Platform.OS === "android" ? { channelId: "partidas" } : null }).catch(() => undefined);
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId]);

  // Tapping a notification opens its match.
  useEffect(() => {
    if (!native) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const matchId = response.notification.request.content.data?.matchId;
      if (typeof matchId === "string") router.push(`/match/${encodeURIComponent(matchId)}`);
    });
    return () => subscription.remove();
  }, []);

  const markAllRead = useCallback(async () => {
    if (!items.some((item) => !item.read_at)) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: now }));
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
  }, [items]);

  const simulate = useCallback(async () => {
    await ensurePermission().catch(() => false);
    const { error } = await supabase.rpc("simulate_notification");
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({ items, unread: items.filter((item) => !item.read_at).length, markAllRead, simulate }), [items, markAllRead, simulate]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used within NotificationsProvider");
  return value;
}
