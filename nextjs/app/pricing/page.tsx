"use client";

import { useRouter } from "next/navigation";
import Pricing from "../../components/Pricing";
import { PlanType } from "../../types";

const PricingPage = () => {
  const router = useRouter();

  const handleSelectPlan = (type: PlanType, price: number) => {
    sessionStorage.setItem("cp_selected_plan", JSON.stringify({ type, price }));
    router.push("/post-a-job");
  };

  return (
    <div className="pt-6">
      <Pricing onSelectPlan={handleSelectPlan} />
    </div>
  );
};

export default PricingPage;
