"use client";

import { useEffect } from "react";
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
      if (profile.role !== "admin" && profile.email.toLowerCase() !== "admin@careerspal.com") {
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
    <div className="pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <AdminDashboard
        onLogout={() => {
          signOut();
          router.push("/");
        }}
      />
    </div>
  );
};

export default AdminDashboardPage;
