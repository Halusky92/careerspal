import { NextResponse } from "next/server";
import { Job } from "../../../../types";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import {
  EMPLOYER_JOB_SELECT,
  EMPLOYER_JOB_SELECT_FALLBACK,
  EMPLOYER_STATUSES,
  getFoundingStatus,
  requireEmployer,
  resolveEmployerCompany,
} from "../../../../lib/employer";
import { formatEmployerSalaryForStorage } from "../../../../lib/formatSalary";
import { isOnNicheJob, NICHE_REJECT_MESSAGE } from "../../../../lib/nicheScope";
import { canUseAdminTestPlan, isAdminTestPrice } from "../../../../lib/adminTestPlan";

const MAX_LIVE_JOBS_PER_HOUR = 12;

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

  if (!body.title || !body.applyUrl || !body.applyUrl.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const allowedStatuses = EMPLOYER_STATUSES;
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const status = auth.role === "admin" ? body.status || "draft" : "draft";
  if (
    !isOnNicheJob({ title: body.title, category: body.category, description: body.description })
  ) {
    return NextResponse.json({ error: NICHE_REJECT_MESSAGE }, { status: 400 });
  }
  const timestamp = body.timestamp || (status === "published" ? Date.now() : null);
  const postedAt = body.postedAt || (status === "published" ? "Just now" : "Draft");
  const rawPlanPrice =
    typeof body.plan?.price === "number" ? body.plan.price : body.planPrice;
  const isAdminTestPriceFlag = Boolean(body.adminInternalPlan) || isAdminTestPrice(rawPlanPrice);
  if (isAdminTestPriceFlag && !canUseAdminTestPlan({ role: auth.role, email: auth.email })) {
    return NextResponse.json({ error: "The $1 test plan is for admins." }, { status: 403 });
  }
  const requestedType = body.planType || body.plan?.type || "Standard";
  let storedPlanType = requestedType;
  let storedPlanPrice =
    typeof rawPlanPrice === "number" ? Math.max(0, Math.round(rawPlanPrice)) : null;
  if (requestedType === "Standard" && !isAdminTestPriceFlag) {
    const founding = await getFoundingStatus(auth.profileId, {
      email: auth.email,
      companyName: body.company || null,
    });
    if (founding.eligible) {
      storedPlanType = "Standard";
      storedPlanPrice = 0;
    } else if (storedPlanPrice === 0) {
      return NextResponse.json({ error: "Start pack is not available for this account." }, { status: 403 });
    }
  }

  if (auth.role !== "admin") {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: liveCount } = await supabaseAdmin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("created_by", auth.profileId)
      .in("status", ["published", "paused"])
      .gte("published_at", cutoff);
    if (typeof liveCount === "number" && liveCount >= MAX_LIVE_JOBS_PER_HOUR) {
      return NextResponse.json(
        { error: "You already published several listings this hour. Fix this draft and try again, or wait about an hour for a new live slot." },
        { status: 429 },
      );
    }
  }

  let companyId: string | null = null;
  if (String(body.company || "").trim()) {
    const companyResult = await resolveEmployerCompany({
      profileId: auth.profileId,
      name: body.company || "",
      website: normalizeHttpUrl(body.companyWebsite),
      logoUrl: normalizeHttpUrl(body.logo),
      description: body.companyDescription || null,
    });
    companyId = companyResult.error === "claim_required" ? null : companyResult.companyId;
  }
  const company = { id: companyId };

  const insertPayload: Record<string, unknown> = {
    title: body.title,
    description: body.description || "",
    location: body.location || "",
    remote_policy: body.remotePolicy || "",
    type: body.type || "Full-time",
    salary: formatEmployerSalaryForStorage(body.salary || ""),
    salary_currency: "USD",
    posted_at_text: postedAt,
    timestamp,
    category: body.category || "Operations",
    apply_url: normalizeApplyUrl(body.applyUrl),
    company_description: body.companyDescription || body.company || null,
    company_website: normalizeHttpUrl(body.companyWebsite),
    logo_url: normalizeHttpUrl(body.logo),
    tags: body.tags || [],
    tools: body.tools || [],
    benefits: body.benefits || [],
    keywords: body.keywords || null,
    match_score: body.matchScore || null,
    is_featured: storedPlanType === "Featured Pro" || storedPlanType === "Elite Managed",
    status,
    plan_type: storedPlanType,
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
    const { origin: _o, salary_currency: _c, ...minimal } = insertPayload;
    const retry = await supabaseAdmin.from("jobs").insert(minimal).select(EMPLOYER_JOB_SELECT_FALLBACK).single();
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
