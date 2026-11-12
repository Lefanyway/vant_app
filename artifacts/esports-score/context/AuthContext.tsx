import type { Session } from "@supabase/supabase-js";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Profile = { id: string; display_name: string | null; notify_saved_results: boolean };

type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (changes: Partial<Pick<Profile, "display_name" | "notify_saved_results">>) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => undefined).finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let active = true;
    supabase.from("profiles").select("id, display_name, notify_saved_results").eq("id", userId).maybeSingle()
      .then(({ data }) => { if (active) setProfile(data ?? { id: userId, display_name: null, notify_saved_results: true }); });
    return () => { active = false; };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
    if (error) throw error;
    // With e-mail confirmation on, Supabase creates the account but returns no session until the link is opened.
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const updateProfile = useCallback(async (changes: Partial<Pick<Profile, "display_name" | "notify_saved_results">>) => {
    if (!userId) return;
    const previous = profile;
    setProfile((current) => current ? { ...current, ...changes } : current);
    const { error } = await supabase.from("profiles").update(changes).eq("id", userId);
    if (error) { setProfile(previous); throw error; }
  }, [profile, userId]);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({ session, ready, profile, signIn, signUp, signOut, updateProfile, updatePassword }), [session, ready, profile, signIn, signUp, signOut, updateProfile, updatePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
