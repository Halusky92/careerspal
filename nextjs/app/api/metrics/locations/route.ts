import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("location")
    .eq("status", "published");
  const locations = Array.from(new Set((jobs || []).map((job) => job.location).filter(Boolean)));
  return NextResponse.json({ locations });
}
