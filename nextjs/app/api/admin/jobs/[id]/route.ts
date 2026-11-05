import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../../lib/supabaseJobs";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { formatSalaryForStorage } from "../../../../../lib/formatSalary";
import { isOnNicheJob, NICHE_REJECT_MESSAGE } from "../../../../../lib/nicheScope";

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

  const body = (await request.json()) as {
    status?: string;
    title?: string;
    description?: string;
    location?: string;
    remotePolicy?: string;
    type?: string;
    salary?: string;
    applyUrl?: string;
    companyWebsite?: string;
    keywords?: string;
  };

  const { data: existing } = await supabaseAdmin
    .from("jobs")
    .select("id,status,title,category,description,stripe_payment_status,plan_price,plan_type,created_by")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const allowedStatuses = new Set(["draft", "published", "paused", "private", "invite_only", "pending_review", "closed", "archived"]);
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.title === "string") updateData.title = body.title;
  if (typeof body.description === "string") updateData.description = body.description;
  if (typeof body.location === "string") updateData.location = body.location;
  if (typeof body.remotePolicy === "string") updateData.remote_policy = body.remotePolicy;
  if (typeof body.type === "string") updateData.type = body.type;
  if (typeof body.salary === "string") updateData.salary = formatSalaryForStorage(body.salary);
  if (typeof body.applyUrl === "string") updateData.apply_url = body.applyUrl;
  if (typeof body.companyWebsite === "string") updateData.company_website = body.companyWebsite;
  if (typeof body.keywords === "string") updateData.keywords = body.keywords;

  if (body.status) {
    if (body.status === "published") {
      const nextTitle = typeof body.title === "string" ? body.title : String((existing as { title?: string | null }).title || "");
      const nextCategory = String((existing as { category?: string | null }).category || "");
      const nextDescription =
        typeof body.description === "string"
          ? body.description
          : String((existing as { description?: string | null }).description || "");
      if (!isOnNicheJob({ title: nextTitle, category: nextCategory, description: nextDescription })) {
        return NextResponse.json({ error: NICHE_REJECT_MESSAGE }, { status: 400 });
      }
      const paymentStatus = String((existing as { stripe_payment_status?: string | null }).stripe_payment_status || "");
      const isPaid = paymentStatus === "paid" || paymentStatus === "founding";
      const planPrice = typeof (existing as { plan_price?: unknown }).plan_price === "number" ? (existing as { plan_price: number }).plan_price : null;
      const isFree = planPrice === 0;
      const createdBy = (existing as { created_by?: string | null }).created_by || null;
      const isAdminCreated = Boolean(createdBy && auth.profile.id && createdBy === auth.profile.id);

      if (!isPaid && !isFree && !isAdminCreated) {
        return NextResponse.json({ error: "Payment not confirmed." }, { status: 400 });
      }
    }
    updateData.status = body.status;
    const now = new Date();
    if (body.status === "published") {
      updateData.published_at = now.toISOString();
      updateData.posted_at_text = "Just now";
      updateData.timestamp = Date.now();
      const planType = String((existing as { plan_type?: string | null }).plan_type || "");
      updateData.is_featured = planType === "Featured Pro" || planType === "Elite Managed";
    }
    if (existing.status === "published" && body.status !== "published") {
      updateData.published_at = null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Missing update fields." }, { status: 400 });
  }

  const { data: updated } = await supabaseAdmin
    .from("jobs")
    .update(updateData)
    .eq("id", id)
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,company_id,origin,companies(name,logo_url,website,description)",
    )
    .single();

  const profileId = auth.profile.id;
  await supabaseAdmin.from("audit_logs").insert({
    action: body.status ? "status_updated" : "job_updated",
    job_id: updated?.id || id,
    actor_id: profileId || null,
    metadata: body.status ? { status: body.status, previousStatus: existing.status } : { fields: Object.keys(updateData) },
  });

  return NextResponse.json({ job: updated ? mapSupabaseJob(updated as SupabaseJobRow) : null });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  await supabaseAdmin.from("jobs").delete().eq("id", id);
  await supabaseAdmin.from("audit_logs").insert({
    action: "job_deleted",
    job_id: id,
    actor_id: auth.profile.id || null,
  });

  return NextResponse.json({ success: true });
}
