import { NextResponse } from "next/server";
import { Job } from "../../../../types";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

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

const ensureEmployer = async (request: Request) => {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = auth.profile.role;
  if (role !== "employer" && role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!supabaseAdmin) {
    return { error: NextResponse.json({ error: "Supabase not configured." }, { status: 500 }) };
  }
  return { profileId: auth.profile.id, email: auth.profile.email, role };
};

export const GET = async (request: Request) => {
  const auth = await ensureEmployer(request);
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
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description)",
    )
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

  const { data } = await queryBuilder;
  const mapped = (data as SupabaseJobRow[]).map(mapSupabaseJob);
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
  const auth = await ensureEmployer(request);
  if ("error" in auth) return auth.error;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as Partial<Job> & {
    planPrice?: number;
  };

  if (!body.title || !body.company || !body.applyUrl || !body.applyUrl.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const allowedStatuses = new Set(["draft", "published", "paused", "private", "invite_only", "pending_review"]);
  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const status = auth.role === "admin" ? body.status || "draft" : "draft";
  const timestamp = body.timestamp || (status === "published" ? Date.now() : null);
  const postedAt = body.postedAt || (status === "published" ? "Just now" : "Draft");

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

  const { data: company } = await supabaseAdmin
    .from("companies")
    .upsert(
      {
        name: body.company,
        website: normalizeHttpUrl(body.companyWebsite),
        logo_url: normalizeHttpUrl(body.logo),
        description: body.companyDescription || null,
        created_by: auth.profileId,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  const { data } = await supabaseAdmin
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
      created_by: auth.profileId,
      company_id: company?.id || null,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description)",
    )
    .single();

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
