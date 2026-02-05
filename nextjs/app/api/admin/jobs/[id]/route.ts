import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../../lib/supabaseJobs";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { status?: string };
  if (!body.status) {
    return NextResponse.json({ error: "Missing status." }, { status: 400 });
  }

  const { data: updated } = await supabaseAdmin
    .from("jobs")
    .update({ status: body.status })
    .eq("id", id)
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description)",
    )
    .single();

  const profileId = auth.profile.id;
  await supabaseAdmin.from("audit_logs").insert({
    action: "status_updated",
    job_id: updated?.id || id,
    actor_id: profileId || null,
    metadata: { status: body.status },
  });

  return NextResponse.json({ job: updated ? mapSupabaseJob(updated as SupabaseJobRow) : null });
}
