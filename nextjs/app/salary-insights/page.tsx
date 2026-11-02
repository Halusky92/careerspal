"use client";

import { useRouter } from "next/navigation";
import SalaryInsights from "../../components/SalaryInsights";

const SalaryInsightsPage = () => {
  const router = useRouter();
  return (
    <div className="pt-6">
      <SalaryInsights onBrowse={() => router.push("/jobs")} />
    </div>
  );
};

export default SalaryInsightsPage;
