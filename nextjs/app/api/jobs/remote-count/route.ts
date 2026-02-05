import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const getMode = (policy: string) => {
  const lower = policy.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("remote")) return "remote";
  return "onsite";
};

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("remote_policy")
    .eq("status", "published");

  const counts = (jobs || []).reduce<Record<string, number>>(
    (acc, job) => {
      const mode = getMode(job.remote_policy || "");
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    },
    { remote: 0, hybrid: 0, onsite: 0 }
  );

  return NextResponse.json(
    { counts },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
