import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../../../lib/supabaseJobs";
import {
  EMPLOYER_JOB_SELECT,
  EMPLOYER_JOB_SELECT_FALLBACK,
  EMPLOYER_STATUSES,
  loadEmployerOwnedJob,
  requireEmployer,
} from "../../../../../lib/employer";
import { formatSalaryForStorage } from "../../../../../lib/formatSalary";
import { canRenewUnpublished, RENEW_PLAN_NAME, RENEW_PRICE } from "../../../../../lib/jobs/unpublishedRetention";

const postedLabel = (status: string) => {
  if (status === "published") return "Just now";
  if (status === "pending_review") return "Pending review";
  if (status === "paused") return "Paused";
  if (status === "closed") return "Closed";
  if (status === "archived") return "Archived";
  return "Draft";
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const owned = await loadEmployerOwnedJob(id, auth.profileId);
  if (!owned.job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  const { data, error } = await supabaseAdmin!
    .from("jobs")
    .select(EMPLOYER_JOB_SELECT_FALLBACK)
    .eq("id", id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  return NextResponse.json({ job: mapSupabaseJob(data as SupabaseJobRow) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const owned = await loadEmployerOwnedJob(id, auth.profileId);
  if (!owned.job) {
    const status = owned.error === "forbidden" || owned.error === "sourced" ? 403 : 404;
    return NextResponse.json({ error: "Job not found." }, { status });
  }

  const body = (await request.json()) as {
    action?: "pause" | "close" | "republish" | "archive" | "renew";
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
    tools?: string[];
    tags?: string[];
  };

  const current = String(owned.job.status || "draft");
  const updateData: Record<string, unknown> = {};

  if (body.action === "pause") {
    if (current !== "published") {
      return NextResponse.json({ error: "Only active listings can be paused." }, { status: 400 });
    }
    updateData.status = "paused";
    updateData.unpublished_at = new Date().toISOString();
  } else if (body.action === "close") {
    if (current !== "published" && current !== "paused") {
      return NextResponse.json({ error: "Only live listings can be closed." }, { status: 400 });
    }
    updateData.status = "closed";
    updateData.unpublished_at = new Date().toISOString();
  } else if (body.action === "republish" || body.action === "renew") {
    if (!canRenewUnpublished(owned.job)) {
      return NextResponse.json(
        { error: "This listing can no longer be renewed. Unpublished listings are removed after 90 days." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "Renewal is Standard checkout, then review.",
        checkoutRequired: true,
        price: RENEW_PRICE,
        planName: RENEW_PLAN_NAME,
        purpose: "republish",
      },
      { status: 402 },
    );
  } else if (body.action === "archive") {
    if (current !== "closed" && current !== "draft") {
      return NextResponse.json({ error: "Archive is for closed or draft listings." }, { status: 400 });
    }
    updateData.status = "archived";
    updateData.unpublished_at = new Date().toISOString();
  }

  if (typeof body.status === "string") {
    if (!EMPLOYER_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    if (body.status === "published") {
      return NextResponse.json({ error: "Listings go live after review." }, { status: 403 });
    }
    updateData.status = body.status;
  }
  if (typeof body.title === "string") updateData.title = body.title;
  if (typeof body.description === "string") updateData.description = body.description;
  if (typeof body.location === "string") updateData.location = body.location;
  if (typeof body.remotePolicy === "string") updateData.remote_policy = body.remotePolicy;
  if (typeof body.type === "string") updateData.type = body.type;
  if (typeof body.salary === "string") updateData.salary = formatSalaryForStorage(body.salary);
  if (typeof body.applyUrl === "string") updateData.apply_url = body.applyUrl;
  if (typeof body.companyWebsite === "string") updateData.company_website = body.companyWebsite;
  if (typeof body.keywords === "string") updateData.keywords = body.keywords;
  if (Array.isArray(body.tools)) updateData.tools = body.tools;
  if (Array.isArray(body.tags)) updateData.tags = body.tags;

  if (updateData.status === "published") {
    updateData.published_at = new Date().toISOString();
    updateData.timestamp = Date.now();
    updateData.posted_at_text = "Just now";
  } else if (typeof updateData.status === "string") {
    updateData.posted_at_text = postedLabel(String(updateData.status));
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  let query = supabaseAdmin!
    .from("jobs")
    .update(updateData)
    .eq("id", id)
    .select(EMPLOYER_JOB_SELECT)
    .single();
  let { data, error } = await query;
  if (error) {
    const { unpublished_at: _unpublished, ...withoutUnpublished } = updateData;
    const retry = await supabaseAdmin!
      .from("jobs")
      .update(withoutUnpublished)
      .eq("id", id)
      .select(EMPLOYER_JOB_SELECT_FALLBACK)
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update listing." }, { status: 500 });
  }

  await supabaseAdmin!.from("audit_logs").insert({
    action: "employer_job_updated",
    job_id: id,
    actor_id: auth.profileId,
    metadata: { action: body.action || "edit", status: (data as { status?: string }).status },
  });

  return NextResponse.json({ job: mapSupabaseJob(data as SupabaseJobRow) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const owned = await loadEmployerOwnedJob(id, auth.profileId);
  if (!owned.job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  const status = String(owned.job.status || "draft");
  if (status !== "draft") {
    return NextResponse.json(
      { error: "Published listings are archived, not deleted, so history and stats stay intact." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin!.from("jobs").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Unable to delete draft." }, { status: 500 });
  }
  await supabaseAdmin!.from("audit_logs").insert({
    action: "employer_job_deleted",
    job_id: id,
    actor_id: auth.profileId,
    metadata: { status },
  });
  return NextResponse.json({ ok: true });
}
