import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin.from("jobs").select("matches");
  const matches = (jobs || []).reduce((sum, job) => sum + (job.matches || 0), 0);
  return NextResponse.json({ matches });
}
