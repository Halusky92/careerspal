"use client";

import { useRouter } from "next/navigation";
import SalaryInsights from "../../components/SalaryInsights";

const SalaryInsightsPage = () => {
  const router = useRouter();
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
      <SalaryInsights onBrowse={() => router.push("/jobs")} />
    </div>
  );
};

export default SalaryInsightsPage;
