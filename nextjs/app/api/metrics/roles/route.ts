import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("type")
    .eq("status", "published");
  const stats = (jobs || []).reduce<Record<string, number>>((acc, job) => {
    if (!job.type) return acc;
    acc[job.type] = (acc[job.type] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json(
    { stats },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
