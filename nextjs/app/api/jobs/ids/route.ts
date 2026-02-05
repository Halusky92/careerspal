import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "published";
  const limitParam = Number(searchParams.get("limit") || "0");
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : undefined;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const query = supabaseAdmin.from("jobs").select("id").eq("status", status);
  const { data: jobs } = take ? await query.limit(take) : await query;
  return NextResponse.json(
    { ids: (jobs || []).map((job) => job.id) },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
