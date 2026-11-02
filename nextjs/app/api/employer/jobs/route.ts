import { NextResponse } from "next/server";
import { Job } from "../../../../types";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import {
  EMPLOYER_JOB_SELECT,
  EMPLOYER_JOB_SELECT_FALLBACK,
  EMPLOYER_STATUSES,
  requireEmployer,
  resolveEmployerCompany,
} from "../../../../lib/employer";
import { formatSalaryForStorage } from "../../../../lib/formatSalary";

const MAX_JOBS_PER_HOUR = 5;

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

const isEmailAllowed = (email?: string | null) => {
  if (!email) return false;
  const allowList = (process.env.ADMIN_TEST_EMAILS || "mb.bilek@gmail.com")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.toLowerCase());
};

export const GET = async (request: Request) => {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const query = (searchParams.get("q") || "").trim();
  const limitParam = Number(searchParams.get("limit") || "0");
  const skipParam = Number(searchParams.get("skip") || "0");
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined;
  const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : undefined;
  let queryBuilder = supabaseAdmin
    .from("jobs")
    .select(EMPLOYER_JOB_SELECT)
    .eq("created_by", auth.profileId)
    .order("created_at", { ascending: false });

  if (status) queryBuilder = queryBuilder.eq("status", status);
  if (query) {
    queryBuilder = queryBuilder.or(`title.ilike.%${query}%,companies.name.ilike.%${query}%`);
  }
  if (take && typeof skip === "number") {
    queryBuilder = queryBuilder.range(skip, skip + take - 1);
  } else if (take) {
    queryBuilder = queryBuilder.range(0, take - 1);
  }

  let { data, error } = await queryBuilder;
  if (error) {
    let fallback = supabaseAdmin
      .from("jobs")
      .select(EMPLOYER_JOB_SELECT_FALLBACK)
      .eq("created_by", auth.profileId)
      .order("created_at", { ascending: false });
    if (status) fallback = fallback.eq("status", status);
    if (query) fallback = fallback.or(`title.ilike.%${query}%`);
    if (take && typeof skip === "number") fallback = fallback.range(skip, skip + take - 1);
    else if (take) fallback = fallback.range(0, take - 1);
    const retry = await fallback;
    data = retry.data as typeof data;
  }
  const rows = ((data || []) as Array<SupabaseJobRow & { origin?: string | null }>).filter(
    (row) => (row.origin || "employer") !== "greenhouse",
  );
  const mapped = rows.map(mapSupabaseJob);
  const summary = mapped.reduce(
    (acc, job) => {
      acc.total += 1;
      const key = job.status || "draft";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );
  return NextResponse.json({ jobs: mapped, summary, total: summary.total || 0 });
};

export const POST = async (request: Request) => {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as Partial<Job> & {
    planPrice?: number;
    adminInternalPlan?: boolean;
  };

  if (!body.title || !body.company || !body.applyUrl || !body.applyUrl.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const allowedStatuses = EMPLOYER_STATUSES;
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const status = auth.role === "admin" ? body.status || "draft" : "draft";
  const timestamp = body.timestamp || (status === "published" ? Date.now() : null);
  const postedAt = body.postedAt || (status === "published" ? "Just now" : "Draft");
  const rawPlanPrice =
    typeof body.plan?.price === "number" ? body.plan.price : body.planPrice;
  const isInternalCheapPrice = typeof rawPlanPrice === "number" && rawPlanPrice <= 5;
  if (body.adminInternalPlan || isInternalCheapPrice) {
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isEmailAllowed(auth.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const storedPlanPrice =
    typeof rawPlanPrice === "number"
      ? rawPlanPrice < 1
        ? 1
        : Math.round(rawPlanPrice)
      : null;

  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", auth.profileId)
    .eq("action", "job_created")
    .gte("created_at", cutoff);
  if (typeof recentCount === "number" && recentCount >= MAX_JOBS_PER_HOUR) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
  }

  const companyResult = await resolveEmployerCompany({
    profileId: auth.profileId,
    name: body.company,
    website: normalizeHttpUrl(body.companyWebsite),
    logoUrl: normalizeHttpUrl(body.logo),
    description: body.companyDescription || null,
  });
  if (companyResult.error === "claim_required") {
    return NextResponse.json(
      {
        error: "This company profile already exists. Claim it from your dashboard first.",
        companyId: companyResult.companyId,
        claimRequired: true,
      },
      { status: 409 },
    );
  }
  const company = { id: companyResult.companyId };

  const insertPayload: Record<string, unknown> = {
    title: body.title,
    description: body.description || "",
    location: body.location || "",
    remote_policy: body.remotePolicy || "",
    type: body.type || "Full-time",
    salary: formatSalaryForStorage(body.salary || ""),
    posted_at_text: postedAt,
    timestamp,
    category: body.category || "Operations",
    apply_url: normalizeApplyUrl(body.applyUrl),
    company_description: body.companyDescription || null,
    company_website: normalizeHttpUrl(body.companyWebsite),
    logo_url: normalizeHttpUrl(body.logo),
    tags: body.tags || [],
    tools: body.tools || [],
    benefits: body.benefits || [],
    keywords: body.keywords || null,
    match_score: body.matchScore || null,
    is_featured: Boolean(body.isFeatured),
    status,
    plan_type: body.planType || null,
    plan_price: storedPlanPrice,
    plan_currency: "USD",
    views: body.views || 0,
    matches: body.matches || 0,
    created_by: auth.profileId,
    origin: "employer",
    company_id: company?.id || null,
    published_at: status === "published" ? new Date().toISOString() : null,
  };
  let { data } = await supabaseAdmin.from("jobs").insert(insertPayload).select(EMPLOYER_JOB_SELECT_FALLBACK).single();
  if (!data) {
    const { origin: _origin, ...withoutOrigin } = insertPayload;
    const retry = await supabaseAdmin.from("jobs").insert(withoutOrigin).select(EMPLOYER_JOB_SELECT_FALLBACK).single();
    data = retry.data;
  }

  if (!data) {
    return NextResponse.json({ error: "Failed to create job." }, { status: 500 });
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "job_created",
    job_id: data.id,
    actor_id: auth.profileId,
    metadata: {
      planType: data.plan_type,
      planPrice: data.plan_price,
      status: data.status,
    },
  });

  return NextResponse.json({ job: mapSupabaseJob(data as SupabaseJobRow) }, { status: 201 });
};
