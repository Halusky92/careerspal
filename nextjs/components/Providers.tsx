"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { bindPostingSessionOwner, clearUnscopedPostingSession, hasPendingPosting, postingOwnerKey } from "@/lib/postingSession";
import { trackFunnel } from "../lib/funnelTrack";

type Profile = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  isOnboarded?: boolean | null;
  createdAt?: string | null;
};

type AuthRole = "candidate" | "employer";

type AuthRedirectOptions = { role?: AuthRole; from?: string | null };

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  accessToken: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: (options?: AuthRedirectOptions) => Promise<void>;
  signInWithEmail: (email: string, options?: AuthRedirectOptions) => Promise<{ error?: string }>;
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

  const maybeContinuePendingAuthFlow = useCallback((userId?: string | null) => {
    if (typeof window === "undefined") return;
    try {
      const path = window.location.pathname || "/";
      // Only auto-navigate when we unexpectedly landed on the homepage.
      if (path !== "/") return;

      const stored =
        window.sessionStorage.getItem("cp_auth_from") || window.localStorage.getItem("cp_auth_from");
      const owner = postingOwnerKey(userId);
      const hasPending = hasPendingPosting(owner);
      const safeFrom = stored && stored.startsWith("/") ? stored : null;
      const target = safeFrom || (hasPending ? "/checkout" : null);
      if (!target) return;

      window.sessionStorage.removeItem("cp_auth_from");
      window.localStorage.removeItem("cp_auth_from");
      window.location.replace(target);
    } catch {
      // ignore
    }
  }, []);

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
      const { data, error } = await supabase.auth.getSession();
      if (error?.message?.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut();
        if (!isActive) return;
        setUser(null);
        setAccessToken(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (!isActive) return;
      const session = data.session;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      await fetchProfile(session?.access_token ?? null);
      // If OAuth/magic-link redirect landed on home, continue flow.
      if (session?.access_token) {
        maybeContinuePendingAuthFlow(session.user?.id);
      }
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
      if (_event === "SIGNED_IN" && session?.access_token) {
        maybeContinuePendingAuthFlow(session.user?.id);
        try {
          const key = `cp_signup_${session.user?.id || "anon"}`;
          if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, "1");
            trackFunnel("signup_completed");
          }
        } catch {
          // ignore
        }
      }
      if (!isActive) return;
      setLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, maybeContinuePendingAuthFlow]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (accessToken) {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `cp_access_token=${accessToken}; Path=/; SameSite=Lax${secure}`;
    } else {
      document.cookie = "cp_access_token=; Path=/; Max-Age=0";
    }
  }, [accessToken]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(accessToken);
  }, [accessToken, fetchProfile]);

  const buildRedirect = useCallback((options?: AuthRedirectOptions) => {
    const url = new URL("/auth", window.location.origin);
    if (options?.role) {
      url.searchParams.set("role", options.role);
    }
    if (options?.from && options.from.startsWith("/")) {
      url.searchParams.set("from", options.from);
    }
    return url.toString();
  }, []);

  const signInWithGoogle = useCallback(
    async (options?: AuthRedirectOptions) => {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: buildRedirect(options) },
      });
    },
    [buildRedirect],
  );

  const signInWithEmail = useCallback(
    async (email: string, options?: AuthRedirectOptions) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: buildRedirect(options) },
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    },
    [buildRedirect],
  );

  useEffect(() => {
    bindPostingSessionOwner(postingOwnerKey(user?.id, profile?.email));
  }, [user?.id, profile?.email]);

  const signOut = useCallback(async () => {
    clearUnscopedPostingSession();
    bindPostingSessionOwner("guest");
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, profile, accessToken, loading, refreshProfile, signInWithGoogle, signInWithEmail, signOut }),
    [accessToken, loading, profile, refreshProfile, signInWithGoogle, signInWithEmail, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default Providers;
