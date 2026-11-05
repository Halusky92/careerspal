"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Auth from "../../components/Auth";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { hasPendingPosting, postingOwnerKey } from "../../lib/postingSession";
import { peekPendingApply } from "../../lib/applyGate";

const AuthPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, accessToken, loading, refreshProfile } = useSupabaseAuth();
  const roleParam = searchParams.get("role");
  const fromParam = searchParams.get("from");
  const desiredRole = roleParam === "employer" || roleParam === "candidate" ? roleParam : null;
  const desiredFrom = fromParam && fromParam.startsWith("/") ? fromParam : null;

  useEffect(() => {
    let isActive = true;
    const syncRoleAndRedirect = async () => {
      if (loading) return;
      if (!profile?.email || !accessToken) return;
      const pending = peekPendingApply();

      const email = profile.email.toLowerCase();
      if (email === "admin@careerspal.com" || profile.role === "admin") {
        if (desiredFrom && desiredFrom.startsWith("/dashboard/admin")) {
          router.replace(desiredFrom);
          return;
        }
        router.replace("/dashboard/admin?tab=review");
        return;
      }

      const currentRole = profile.role || "candidate";
      if (desiredRole === "employer" && currentRole === "candidate") {
        try {
          await authFetch(
            "/api/account/role",
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "employer" }),
            },
            accessToken,
          );
          await refreshProfile();
        } catch {
          // keep current role
        }
      }

      const finalRole = desiredRole === "employer" ? "employer" : currentRole || "candidate";
      if (!isActive) return;
      let finalFrom: string | null = desiredFrom || pending?.returnTo || null;
      if (!finalFrom) {
        try {
          const stored = sessionStorage.getItem("cp_auth_from");
          const storedPersistent = localStorage.getItem("cp_auth_from");
          if (stored && stored.startsWith("/")) finalFrom = stored;
          if (!finalFrom && storedPersistent && storedPersistent.startsWith("/")) finalFrom = storedPersistent;
          if (!finalFrom) {
            const hasPending = hasPendingPosting(postingOwnerKey(user?.id, profile?.email));
            if (hasPending) finalFrom = "/post-a-job";
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
        router.replace(finalRole === "employer" ? "/dashboard/employer" : "/account");
      }
    };

    syncRoleAndRedirect();
    return () => {
      isActive = false;
    };
  }, [router, accessToken, loading, profile, refreshProfile, desiredRole, desiredFrom, user?.id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <p className="text-sm text-slate-500">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10">
      <Auth />
    </div>
  );
};

export default AuthPage;
