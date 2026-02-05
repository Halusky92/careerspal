"use client";

import { useRouter } from "next/navigation";
import Pricing from "../../components/Pricing";
import { PlanType } from "../../types";
import { useSupabaseAuth } from "../../components/Providers";

const PricingPage = () => {
  const router = useRouter();
  const { profile, loading: authLoading } = useSupabaseAuth();

  const handleSelectPlan = (type: PlanType, price: number) => {
    sessionStorage.setItem("cp_selected_plan", JSON.stringify({ type, price }));
    if (!profile?.email) {
      router.push("/auth");
      return;
    }
    if (profile?.role && profile.role !== "employer" && profile.role !== "admin") {
      router.push("/dashboard/candidate");
      return;
    }
    router.push("/post-a-job");
  };

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Loading pricing...
        </div>
      </div>
    );
  }

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
      <Pricing onSelectPlan={handleSelectPlan} />
    </div>
  );
};

export default PricingPage;
