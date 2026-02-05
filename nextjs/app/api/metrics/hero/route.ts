import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const [jobs, employers, candidates, saved] = await Promise.all([
    supabaseAdmin.from("jobs").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "employer"),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "candidate"),
    supabaseAdmin.from("saved_jobs").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json(
    { jobs: jobs.count || 0, employers: employers.count || 0, candidates: candidates.count || 0, saved: saved.count || 0 },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
