"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";

type Profile = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  isOnboarded?: boolean | null;
  createdAt?: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  accessToken: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useSupabaseAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within Providers.");
  }
  return context;
};

type ProvidersProps = {
  children: React.ReactNode;
};

const Providers = ({ children }: ProvidersProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(
    async (token: string | null) => {
      if (!token) {
        setProfile(null);
        return;
      }
      const response = await authFetch("/api/account", {}, token);
      if (!response.ok) {
        setProfile(null);
        return;
      }
      const data = (await response.json()) as { user?: Profile | null };
      setProfile(data.user || null);
    },
    [],
  );

  useEffect(() => {
    let isActive = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isActive) return;
      const session = data.session;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      await fetchProfile(session?.access_token ?? null);
      if (!isActive) return;
      setLoading(false);
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isActive) return;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      await fetchProfile(session?.access_token ?? null);
      if (!isActive) return;
      setLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(accessToken);
  }, [accessToken, fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, profile, accessToken, loading, refreshProfile, signInWithGoogle, signOut }),
    [accessToken, loading, profile, refreshProfile, signInWithGoogle, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default Providers;
