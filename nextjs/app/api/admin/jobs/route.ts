import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { Job } from "../../../../types";

export const runtime = "nodejs";

const normalizeApplyUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed === "#" || trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
  if (trimmed.includes("@") && !trimmed.includes(":")) return `mailto:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return trimmed;
};

const normalizeHttpUrl = (value?: string | null) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return trimmed;
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description)",
    )
    .order("created_at", { ascending: false });
  return NextResponse.json({ jobs: (jobs as SupabaseJobRow[]).map(mapSupabaseJob) });
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as Partial<Job> & {
    status?: string;
    planType?: string;
    isFeatured?: boolean;
    tagsCsv?: string;
    toolsCsv?: string;
  };

  if (!body.title || !body.company || !body.applyUrl || !body.applyUrl.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const allowedStatuses = new Set(["draft", "published", "paused", "private", "invite_only", "pending_review"]);
  const status = body.status && allowedStatuses.has(body.status) ? body.status : "published";

  const nowIso = new Date().toISOString();
  const isPublished = status === "published";
  const timestamp = isPublished ? Date.now() : null;
  const postedAt = isPublished ? "Just now" : status === "pending_review" ? "Pending review" : "Draft";

  const tags =
    typeof body.tagsCsv === "string"
      ? body.tagsCsv
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : Array.isArray(body.tags)
        ? body.tags
        : [];
  const tools =
    typeof body.toolsCsv === "string"
      ? body.toolsCsv
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : Array.isArray(body.tools)
        ? body.tools
        : [];

  const planType = (body.planType || body.planType === "" ? body.planType : body.plan?.type) || "Standard";
  const isFeatured = typeof body.isFeatured === "boolean" ? body.isFeatured : planType !== "Standard";

  const { data: company } = await supabaseAdmin
    .from("companies")
    .upsert(
      {
        name: body.company,
        website: normalizeHttpUrl(body.companyWebsite),
        logo_url: normalizeHttpUrl(body.logo),
        description: body.companyDescription || null,
        created_by: auth.profile.id,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  const { data: created } = await supabaseAdmin
    .from("jobs")
    .insert({
      title: body.title,
      description: body.description || "",
      location: body.location || "Remote",
      remote_policy: body.remotePolicy || "Remote",
      type: body.type || "Full-time",
      salary: body.salary || "",
      posted_at_text: postedAt,
      timestamp,
      category: body.category || "Operations",
      apply_url: normalizeApplyUrl(body.applyUrl),
      company_description: body.companyDescription || null,
      company_website: normalizeHttpUrl(body.companyWebsite),
      logo_url: normalizeHttpUrl(body.logo),
      tags,
      tools,
      benefits: Array.isArray(body.benefits) ? body.benefits : [],
      keywords: body.keywords || null,
      match_score: body.matchScore || null,
      is_featured: Boolean(isFeatured),
      status,
      plan_type: planType,
      plan_price: 0,
      plan_currency: "USD",
      views: 0,
      matches: 0,
      created_by: auth.profile.id,
      company_id: company?.id || null,
      published_at: isPublished ? nowIso : null,
      stripe_payment_status: "paid",
      stripe_session_id: null,
    })
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description)",
    )
    .single();

  if (!created) {
    return NextResponse.json({ error: "Failed to create job." }, { status: 500 });
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "job_created_admin",
    job_id: created.id,
    actor_id: auth.profile.id || null,
    metadata: { status, planType, isFeatured },
  });

  return NextResponse.json({ job: mapSupabaseJob(created as SupabaseJobRow) }, { status: 201 });
}
