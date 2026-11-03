"use client";

import { useRouter } from "next/navigation";
import Pricing from "../../components/Pricing";
import { PlanType } from "../../types";
import { useSupabaseAuth } from "../../components/Providers";
import { postingOwnerKey, writePostingItem } from "../../lib/postingSession";

const PricingPage = () => {
  const router = useRouter();
  const { user, profile } = useSupabaseAuth();

  const handleSelectPlan = (type: PlanType, price: number) => {
    writePostingItem("cp_selected_plan", postingOwnerKey(user?.id, profile?.email), JSON.stringify({ type, price }));
    router.push("/post-a-job");
  };

  return (
    <div className="pt-6">
      <Pricing onSelectPlan={handleSelectPlan} />
    </div>
  );
};

export default PricingPage;
