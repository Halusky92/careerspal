"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "../../../components/Providers";

export default function CandidateDashboardPage() {
  const router = useRouter();
  const { profile, loading } = useSupabaseAuth();

  useEffect(() => {
    if (loading) return;
    if (!profile?.email) {
      router.replace("/auth");
      return;
    }
    if (profile.role === "admin") {
      router.replace("/dashboard/admin");
      return;
    }
    if (profile.role === "employer") {
      router.replace("/dashboard/employer");
      return;
    }
    router.replace("/account");
  }, [loading, profile, router]);

  return <div className="py-16 text-center text-sm text-slate-500">Opening your profile…</div>;
}
