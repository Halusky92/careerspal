"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Auth from "../../components/Auth";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";

const AuthPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, accessToken, loading, refreshProfile } = useSupabaseAuth();
  const roleParam = searchParams.get("role");
  const fromParam = searchParams.get("from");
  const desiredRole = roleParam === "employer" || roleParam === "candidate" ? roleParam : null;
  const desiredFrom = fromParam && fromParam.startsWith("/") ? fromParam : null;

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

      const finalRole = desiredRole || currentRole || "candidate";
      if (!isActive) return;
      let finalFrom: string | null = desiredFrom;
      if (!finalFrom) {
        try {
          const stored = sessionStorage.getItem("cp_auth_from");
          const storedPersistent = localStorage.getItem("cp_auth_from");
          if (stored && stored.startsWith("/")) finalFrom = stored;
          if (!finalFrom && storedPersistent && storedPersistent.startsWith("/")) finalFrom = storedPersistent;
          if (!finalFrom) {
            const hasPending = Boolean(sessionStorage.getItem("cp_pending_job") || sessionStorage.getItem("cp_pending_job_id"));
            if (hasPending) finalFrom = "/checkout";
          }
        } catch {
          // ignore
        }
      }
      try {
        sessionStorage.removeItem("cp_auth_from");
        localStorage.removeItem("cp_auth_from");
      } catch {
        // ignore
      }

      if (finalFrom) {
        router.replace(finalFrom);
      } else {
        router.replace(finalRole === "employer" ? "/dashboard/employer" : "/dashboard/candidate");
      }
    };

    syncRoleAndRedirect();
    return () => {
      isActive = false;
    };
  }, [router, accessToken, loading, profile, refreshProfile, desiredRole, desiredFrom]);

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
