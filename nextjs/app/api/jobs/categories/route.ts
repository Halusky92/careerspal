import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase();
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

  const filtered = Object.entries(counts).reduce<Record<string, number>>((acc, [key, value]) => {
    if (!q || key.toLowerCase().includes(q)) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return NextResponse.json(
    { categories: filtered },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
