"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "../../../components/AdminDashboard";
import { useSupabaseAuth } from "../../../components/Providers";

const AdminDashboardPage = () => {
  const router = useRouter();
  const { profile, loading: authLoading, signOut } = useSupabaseAuth();

  useEffect(() => {
    try {
      if (authLoading) return;
      if (!profile?.email) {
        router.replace("/auth");
        return;
      }
      if (profile.role !== "admin") {
        router.replace("/auth");
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
          Loading admin console...
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-24 text-center text-slate-500">Loading admin console...</div>
      }
    >
      <AdminDashboard
        onLogout={() => {
          signOut();
          router.push("/");
        }}
      />
    </Suspense>
  );
};

export default AdminDashboardPage;
