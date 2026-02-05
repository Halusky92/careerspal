"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Auth from "../../components/Auth";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";

const AuthPage = () => {
  const router = useRouter();
  const { profile, accessToken, loading, refreshProfile } = useSupabaseAuth();

  useEffect(() => {
    let isActive = true;
    const syncRoleAndRedirect = async () => {
      if (loading) return;
      if (!profile?.email || !accessToken) return;

      const email = profile.email.toLowerCase();
      if (email === "admin@careerspal.com" || profile.role === "admin") {
        router.replace("/dashboard/admin");
        return;
      }

      const desiredRole = typeof window !== "undefined" ? localStorage.getItem("cp_role") : null;
      const currentRole = profile.role || "candidate";
      if (desiredRole && desiredRole !== currentRole) {
        try {
          await authFetch(
            "/api/account/role",
            {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: desiredRole }),
            },
            accessToken,
          );
          await refreshProfile();
        } catch {
          // keep current role
        }
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem("cp_role");
      }

      const finalRole = desiredRole || currentRole || "candidate";
      if (!isActive) return;
      router.replace(finalRole === "employer" ? "/dashboard/employer" : "/dashboard/candidate");
    };

    syncRoleAndRedirect();
    return () => {
      isActive = false;
    };
  }, [router, accessToken, loading, profile, refreshProfile]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Checking session...
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <Auth />
    </div>
  );
};

export default AuthPage;
