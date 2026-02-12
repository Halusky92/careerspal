import { NextResponse } from "next/server";
import { Job } from "../../../types";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../lib/supabaseJobs";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";

const isValidApplyUrl = (value: string) => {
  if (value === "#" || value.startsWith("/")) return true;
  if (value.startsWith("mailto:")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const GET = async (request: Request) => {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "0");
  const skipParam = Number(searchParams.get("skip") || "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined;
  const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : undefined;
  // Public endpoint: never expose draft/private/pending jobs.
  const requestedStatus = searchParams.get("status");
  const status = requestedStatus === "invite_only" ? "invite_only" : "published";
  const company = searchParams.get("company");
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const planType = searchParams.get("planType");
  const remote = searchParams.get("remote");
  // Note: we use `timestamp` (ms) for recency filtering because it's reliably set on publish.
  // Some legacy/imported records may have `published_at` missing, which would incorrectly hide live roles.
  const publishedCutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let query = supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description)",
      { count: "exact" },
    )
    .order("timestamp", { ascending: false });

  query = query.eq("status", status);
  if (status === "published") query = query.gte("timestamp", publishedCutoffMs);
  if (category) query = query.eq("category", category);
  if (type) query = query.eq("type", type);
  if (planType) query = query.eq("plan_type", planType);
  if (remote) query = query.ilike("remote_policy", `%${remote}%`);
  if (company) query = query.ilike("companies.name", `%${company}%`);
  if (limit && typeof skip === "number") {
    query = query.range(skip, skip + limit - 1);
  } else if (limit) {
    query = query.range(0, limit - 1);
  }

  const { data, count } = await query;
  const mapped = (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
  return NextResponse.json(
    { jobs: mapped, total: count ?? mapped.length },
    // Ensure public pages reflect archive/delete immediately.
    { headers: { "Cache-Control": "no-store" } },
  );
};

export const POST = async (request: Request) => {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as Partial<Job> & {
    planPrice?: number;
  };

  if (!body.title || !body.company || !body.applyUrl) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!isValidApplyUrl(body.applyUrl)) {
    return NextResponse.json({ error: "Invalid applyUrl." }, { status: 400 });
  }

  const allowedStatuses = new Set(["draft", "published", "paused", "private", "invite_only", "pending_review"]);
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const status = body.status || "draft";
  const timestamp = body.timestamp || (status === "published" ? Date.now() : null);
  const postedAt = body.postedAt || (status === "published" ? "Just now" : "Draft");

  const profileId = auth.profile.id;
  if (!profileId) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .upsert(
      {
        name: body.company,
        website: body.companyWebsite || null,
        logo_url: body.logo || null,
        description: body.companyDescription || null,
        created_by: profileId,
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
      apply_url: body.applyUrl,
      company_description: body.companyDescription || null,
      company_website: body.companyWebsite || null,
      logo_url: body.logo || null,
      tags: body.tags || [],
      tools: body.tools || [],
      benefits: body.benefits || [],
      keywords: body.keywords || null,
      match_score: body.matchScore || null,
      is_featured: Boolean(body.isFeatured),
      status,
      plan_type: body.planType || null,
      plan_price: body.plan?.price || body.planPrice || null,
      plan_currency: "USD",
      views: body.views || 0,
      matches: body.matches || 0,
        created_by: profileId,
      company_id: company?.id || null,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description)",
    )
    .single();

  if (!created) {
    return NextResponse.json({ error: "Failed to create job." }, { status: 500 });
  }

  return NextResponse.json({ job: mapSupabaseJob(created as SupabaseJobRow) }, { status: 201 });
};
