import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("category")
    .eq("status", "published");
  const counts = (jobs || []).reduce<Record<string, number>>((acc, job) => {
    if (!job.category) return acc;
    acc[job.category] = (acc[job.category] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({ categories: counts });
}
