"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import EmployerDashboard from "../../../components/EmployerDashboard";
import { useSupabaseAuth } from "../../../components/Providers";

const EmployerDashboardPage = () => {
  const router = useRouter();
  const { profile, loading: authLoading } = useSupabaseAuth();

  useEffect(() => {
    try {
      if (authLoading) return;
      if (!profile?.email) {
        router.replace("/auth");
        return;
      }
      if (profile.role === "admin") {
        router.replace("/dashboard/admin");
        return;
      }
      if (profile.role !== "employer") {
        router.replace("/dashboard/candidate");
      }
    } catch {
      router.replace("/auth");
    }
  }, [authLoading, profile, router]);

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <EmployerDashboard
      onUpgrade={() => router.push("/pricing")}
      onPostJob={() => router.push("/post-a-job")}
    />
  );
};

export default EmployerDashboardPage;
