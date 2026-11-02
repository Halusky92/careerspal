"use client";

import { useRouter } from "next/navigation";
import HireTalent from "../../components/HireTalent";

const HireTalentPage = () => {
  const router = useRouter();

  return <HireTalent onPostJob={() => router.push("/post-a-job")} />;
};

export default HireTalentPage;
