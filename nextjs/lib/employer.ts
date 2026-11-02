import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";
import { getSupabaseProfile } from "./supabaseServerAuth";
import {
  FOUNDING_COMPANY_CAP,
  FOUNDING_JOBS_PER_COMPANY,
  isFoundingLaunchEnabled,
  START_PACK_NEXT_PRICE,
  type StartPackStatus,
} from "./founding";

export const EMPLOYER_JOB_SELECT =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,origin,company_id,created_by,companies(name,slug,logo_url,website,description)";

export const EMPLOYER_JOB_SELECT_FALLBACK =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,company_id,created_by,companies(name,slug,logo_url,website,description)";

export const EMPLOYER_STATUSES = new Set([
  "draft",
  "published",
  "paused",
  "private",
  "invite_only",
  "pending_review",
  "closed",
  "archived",
]);

const COUNTED_FOUNDING_STATUSES = new Set([
  "pending_review",
  "published",
  "paused",
  "closed",
  "archived",
]);

export async function requireEmployer(request: Request) {
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
}

export async function loadEmployerOwnedJob(jobId: string, profileId: string) {
  if (!supabaseAdmin) return { job: null as Record<string, unknown> | null, error: "not_configured" };
  const full = await supabaseAdmin
    .from("jobs")
    .select("id,title,description,salary,apply_url,status,origin,created_by,company_id,stripe_payment_status,plan_type,plan_price,views,matches")
    .eq("id", jobId)
    .maybeSingle();
  const data = full.error
    ? (
        await supabaseAdmin
          .from("jobs")
          .select("id,title,description,salary,apply_url,status,created_by,company_id,stripe_payment_status,views,matches")
          .eq("id", jobId)
          .maybeSingle()
      ).data
    : full.data;
  if (!data) return { job: null, error: "not_found" };
  if (data.created_by !== profileId) return { job: null, error: "forbidden" };
  if (((data as { origin?: string | null }).origin || "employer") === "greenhouse") return { job: null, error: "sourced" };
  return { job: data, error: null };
}

export async function resolveEmployerCompany(args: {
  profileId: string;
  name: string;
  website?: string | null;
  logoUrl?: string | null;
  description?: string | null;
}) {
  if (!supabaseAdmin) return { companyId: null as string | null, error: "not_configured" as const, existing: null as Record<string, unknown> | null };
  const name = args.name.trim();
  const { data: existing } = await supabaseAdmin
    .from("companies")
    .select("id,name,claimed_by,created_by,website,logo_url,description")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const claimedBy = (existing as { claimed_by?: string | null }).claimed_by;
    const createdBy = (existing as { created_by?: string | null }).created_by;
    const owns = claimedBy === args.profileId || createdBy === args.profileId;
    if (!owns) {
      return { companyId: existing.id, error: "claim_required" as const, existing };
    }
    return { companyId: existing.id, error: null, existing };
  }

  const payload = {
    name,
    website: args.website || null,
    logo_url: args.logoUrl || null,
    description: args.description || null,
    created_by: args.profileId,
    claimed_by: args.profileId,
  };
  let { data: created, error } = await supabaseAdmin.from("companies").insert(payload).select("id").single();
  if (error) {
    const { claimed_by: _claimed, ...withoutClaim } = payload;
    const retry = await supabaseAdmin.from("companies").insert(withoutClaim).select("id").single();
    created = retry.data;
    error = retry.error;
  }

  if (error || !created?.id) {
    return { companyId: null, error: "create_failed" as const, existing: null };
  }
  return { companyId: created.id, error: null, existing: created };
}

const emptyStartPack = (reason: string, extra?: Partial<StartPackStatus>): StartPackStatus => ({
  enabled: false,
  eligible: false,
  remainingSlots: 0,
  remainingJobs: 0,
  usedJobs: 0,
  quota: FOUNDING_JOBS_PER_COMPANY,
  nextPrice: START_PACK_NEXT_PRICE,
  reason,
  ...extra,
});

export async function getFoundingStatus(profileId: string): Promise<StartPackStatus> {
  if (!supabaseAdmin) {
    return emptyStartPack("not_configured");
  }
  if (!isFoundingLaunchEnabled()) {
    return emptyStartPack("launch_closed");
  }

  const { data: myCompany } = await supabaseAdmin
    .from("companies")
    .select("id,founding_expires_at,claimed_by,created_by")
    .or(`claimed_by.eq.${profileId},created_by.eq.${profileId}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const myExpiry = myCompany?.founding_expires_at ? new Date(myCompany.founding_expires_at).getTime() : 0;
  const alreadyFounding = Boolean(myExpiry && myExpiry > now);

  const { count: foundingCompanies } = await supabaseAdmin
    .from("companies")
    .select("id", { count: "exact", head: true })
    .gt("founding_expires_at", new Date().toISOString());

  const usedSlots = typeof foundingCompanies === "number" ? foundingCompanies : 0;
  const remainingSlots = Math.max(0, FOUNDING_COMPANY_CAP - usedSlots);

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id,status,origin,plan_price,stripe_payment_status")
    .eq("created_by", profileId);
  const usedJobs = (jobs || []).filter((job) => {
    if ((job.origin || "employer") === "greenhouse") return false;
    if (!COUNTED_FOUNDING_STATUSES.has(job.status || "")) return false;
    return job.plan_price === 0 || job.stripe_payment_status === "founding";
  }).length;
  const remainingJobs = Math.max(0, FOUNDING_JOBS_PER_COMPANY - usedJobs);
  const base = {
    enabled: true,
    remainingSlots,
    remainingJobs,
    usedJobs,
    quota: FOUNDING_JOBS_PER_COMPANY,
    nextPrice: START_PACK_NEXT_PRICE,
    companyId: myCompany?.id || null,
  };

  if (!alreadyFounding && remainingSlots <= 0) {
    return { ...base, eligible: false, reason: "no_slots" };
  }
  if (remainingJobs <= 0) {
    return { ...base, remainingJobs: 0, eligible: false, reason: "job_cap" };
  }

  return {
    ...base,
    eligible: true,
    reason: alreadyFounding ? "founding_member" : "open",
  };
}
