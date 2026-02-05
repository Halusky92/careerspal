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
    .select("location")
    .eq("status", "published");

  const locations = Array.from(new Set((jobs || []).map((job) => job.location).filter(Boolean)))
    .filter((location) => (q ? location.toLowerCase().includes(q) : true))
    .sort((a, b) => a.localeCompare(b));
  return NextResponse.json(
    { locations },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
