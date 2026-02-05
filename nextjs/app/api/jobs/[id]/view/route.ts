import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: job } = await supabaseAdmin.from("jobs").select("id,views").eq("id", id).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const nextViews = (job.views || 0) + 1;
  await supabaseAdmin.from("jobs").update({ views: nextViews }).eq("id", id);

  await supabaseAdmin.from("audit_logs").insert({
    action: "view",
    job_id: job.id,
    metadata: { views: nextViews },
  });

  return NextResponse.json({ views: nextViews });
}
