"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "../../components/Providers";
import HireTalent from "../../components/HireTalent";

const HireTalentPage = () => {
  const router = useRouter();
  const { profile, loading } = useSupabaseAuth();

  useEffect(() => {
    if (!loading && profile?.role === "candidate") {
      router.replace("/jobs");
    }
  }, [loading, profile?.role, router]);

  return (
    <div className="pt-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <HireTalent onPostJob={() => router.push("/post-a-job")} />
    </div>
  );
};

export default HireTalentPage;
