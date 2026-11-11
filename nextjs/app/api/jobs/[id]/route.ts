import { NextRequest, NextResponse } from "next/server";
import { Job } from "../../../../types";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { isOnNicheJob } from "../../../../lib/nicheScope";

export const GET = async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,created_by,companies(name,slug,logo_url,website,description,verified)",
    )
    .eq("id", id)
    .single();

  if (!data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const row = data as SupabaseJobRow & { created_by?: string | null };
  const mapped = mapSupabaseJob(row);
  if (row.status !== "published" || !isOnNicheJob(mapped)) {
    const auth = await getSupabaseProfile(_request);
    if (!auth?.profile) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const isOwner = auth.profile.id && row.created_by === auth.profile.id;
    if (!isOwner && auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job: mapped });
  }
  return NextResponse.json({ job: mapped });
};

export const PATCH = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as Partial<Job>;
  const allowedStatuses = new Set(["draft", "published", "paused", "private", "invite_only", "pending_review", "closed", "archived"]);
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: existing } = await supabaseAdmin
    .from("jobs")
    .select("created_by")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const isOwner = existing.created_by && existing.created_by === auth.profile.id;
  if (!isOwner && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.status === "published" || body.status === "pending_review") {
    return NextResponse.json({ error: "An admin approves listings. Payment status cannot be set here." }, { status: 403 });
  }
  if (body.status && allowedStatuses.has(body.status)) data.status = body.status;
  if (typeof body.views === "number") data.views = body.views;
  if (typeof body.matches === "number") data.matches = body.matches;
  if (body.postedAt) data.posted_at_text = body.postedAt;
  if (typeof body.timestamp === "number") data.timestamp = body.timestamp;

  const { data: updated } = await supabaseAdmin
    .from("jobs")
    .update(data)
    .eq("id", id)
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description,verified)",
    )
    .single();

  if (!updated) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job: mapSupabaseJob(updated as SupabaseJobRow) });
};
