import HireTalent from "../../components/HireTalent";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { applyLiveBoardFilter } from "../../lib/liveBoard";

export const dynamic = "force-dynamic";

export default async function HireTalentPage() {
  let companyNames: string[] = [];
  if (supabaseAdmin) {
    const { data } = await applyLiveBoardFilter(
      supabaseAdmin.from("jobs").select("companies(name),timestamp").eq("status", "published"),
    )
      .order("timestamp", { ascending: false })
      .limit(40);
    const names = new Set<string>();
    for (const row of data || []) {
      const rel = row.companies as { name?: string | null } | { name?: string | null }[] | null;
      const company = Array.isArray(rel) ? rel[0] : rel;
      const name = (company?.name || "").trim();
      if (name) names.add(name);
      if (names.size >= 8) break;
    }
    companyNames = Array.from(names);
  }
  return <HireTalent companyNames={companyNames} />;
}
