"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import OpsConsole from "../../../components/OpsConsole";
import { useSupabaseAuth } from "../../../components/Providers";

const OpsPage = () => {
  const router = useRouter();
  const { profile, loading: authLoading } = useSupabaseAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.email || profile.role !== "admin") {
      router.replace("/auth?from=/dashboard/ops");
    }
  }, [authLoading, profile, router]);

  if (authLoading || profile?.role !== "admin") {
    return <div className="min-h-[50vh] bg-zinc-950 text-zinc-500 text-sm flex items-center justify-center">Opening ops console…</div>;
  }

  return <OpsConsole />;
};

export default OpsPage;
