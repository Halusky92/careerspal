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
import { startPackUsage, type StartPackJobRow } from "./startPackQuota";
import { mergeStartPackUsage, startPackLedgerCounts } from "./startPackLedger";
import { hostnameDomain, normalizeCompanyKey, workEmailDomain } from "./workEmailDomain";

export const EMPLOYER_JOB_SELECT =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,origin,company_id,created_by,companies(name,slug,logo_url,website,description)";

export const EMPLOYER_JOB_SELECT_FALLBACK =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,company_id,created_by,companies(name,slug,logo_url,website,description)";

export type EmployerOwnedJob = {
  id: string;
  title: string | null;
  description: string | null;
  salary: string | null;
  apply_url: string | null;
  company_description?: string | null;
  status: string | null;
  origin?: string | null;
  created_by: string | null;
  company_id: string | null;
  stripe_payment_status: string | null;
  plan_type: string | null;
  plan_price: number | null;
  views: number | null;
  matches: number | null;
};

const EMPLOYER_OWNED_JOB_SELECT =
  "id,title,description,salary,apply_url,status,origin,created_by,company_id,company_description,stripe_payment_status,plan_type,plan_price,views,matches";

const EMPLOYER_OWNED_JOB_SELECT_FALLBACK =
  "id,title,description,salary,apply_url,status,created_by,company_id,company_description,stripe_payment_status,plan_type,plan_price,views,matches";

function toEmployerOwnedJob(row: {
  id: string;
  title?: string | null;
  description?: string | null;
  salary?: string | null;
  apply_url?: string | null;
  company_description?: string | null;
  status?: string | null;
  origin?: string | null;
  created_by?: string | null;
  company_id?: string | null;
  stripe_payment_status?: string | null;
  plan_type?: string | null;
  plan_price?: number | null;
  views?: number | null;
  matches?: number | null;
}): EmployerOwnedJob {
  return {
    id: row.id,
    title: row.title ?? null,
    description: row.description ?? null,
    salary: row.salary ?? null,
    apply_url: row.apply_url ?? null,
    company_description: row.company_description ?? null,
    status: row.status ?? null,
    origin: row.origin ?? null,
    created_by: row.created_by ?? null,
    company_id: row.company_id ?? null,
    stripe_payment_status: row.stripe_payment_status ?? null,
    plan_type: row.plan_type ?? null,
    plan_price: typeof row.plan_price === "number" ? row.plan_price : null,
    views: typeof row.views === "number" ? row.views : null,
    matches: typeof row.matches === "number" ? row.matches : null,
  };
}

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

export type StartPackHint = {
  companyId?: string | null;
  companyName?: string | null;
  email?: string | null;
};

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

export async function loadEmployerOwnedJob(
  jobId: string,
  profileId: string,
): Promise<{ job: EmployerOwnedJob | null; error: "not_configured" | "not_found" | "forbidden" | "sourced" | null }> {
  if (!supabaseAdmin) return { job: null, error: "not_configured" };
  const full = await supabaseAdmin
    .from("jobs")
    .select(EMPLOYER_OWNED_JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle();
  const data = full.error
    ? (
        await supabaseAdmin
          .from("jobs")
          .select(EMPLOYER_OWNED_JOB_SELECT_FALLBACK)
          .eq("id", jobId)
          .maybeSingle()
      ).data
    : full.data;
  if (!data) return { job: null, error: "not_found" };
  const job = toEmployerOwnedJob(data);
  if (job.created_by !== profileId) return { job: null, error: "forbidden" };
  return { job, error: null };
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
    await fillEmptyCompanyProfile(existing.id, {
      website: args.website,
      logoUrl: args.logoUrl,
      description: args.description,
    });
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

export async function fillEmptyCompanyProfile(
  companyId: string,
  fields: { website?: string | null; logoUrl?: string | null; description?: string | null },
) {
  if (!supabaseAdmin) return;
  const { data } = await supabaseAdmin
    .from("companies")
    .select("website,logo_url,description")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) return;
  const patch: Record<string, string> = {};
  if (!String(data.website || "").trim() && fields.website) patch.website = fields.website;
  if (!String(data.logo_url || "").trim() && fields.logoUrl) patch.logo_url = fields.logoUrl;
  if (!String(data.description || "").trim() && fields.description) patch.description = fields.description;
  if (Object.keys(patch).length === 0) return;
  await supabaseAdmin.from("companies").update(patch).eq("id", companyId);
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

async function loadStartPackCluster(profileId: string, hint?: StartPackHint) {
  if (!supabaseAdmin) {
    return { companyIds: [] as string[], profileIds: [profileId], email: hint?.email || "", companyId: hint?.companyId || null };
  }

  let email = (hint?.email || "").trim();
  if (!email) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("id", profileId).maybeSingle();
    email = profile?.email || "";
  }
  const domain = workEmailDomain(email);
  const profileIds = new Set<string>([profileId]);

  if (domain) {
    const { data: teammates } = await supabaseAdmin
      .from("profiles")
      .select("id,email")
      .ilike("email", `%@${domain}`);
    for (const row of teammates || []) {
      if (workEmailDomain(row.email) === domain) profileIds.add(row.id);
    }
  }

  const ids = [...profileIds];
  const companyIds = new Set<string>();
  if (hint?.companyId) companyIds.add(hint.companyId);

  const ownerFilter = ids.map((id) => `claimed_by.eq.${id},created_by.eq.${id}`).join(",");
  const { data: ownedCompanies } = await supabaseAdmin
    .from("companies")
    .select("id,name,website,claimed_by,created_by,founding_expires_at")
    .or(ownerFilter);

  for (const row of ownedCompanies || []) {
    if (row.id) companyIds.add(row.id);
  }

  const hintKey = normalizeCompanyKey(hint?.companyName);
  if (hint && hintKey) {
    const nameQuery = (hint.companyName || "").trim().replace(/[%_,()]/g, " ").slice(0, 80);
    const { data: named } = await supabaseAdmin.from("companies").select("id,name").ilike("name", `%${nameQuery}%`).limit(25);
    for (const row of named || []) {
      if (normalizeCompanyKey(row.name) === hintKey && row.id) companyIds.add(row.id);
    }
  }

  if (domain) {
    const { data: bySite } = await supabaseAdmin.from("companies").select("id,website").ilike("website", `%${domain}%`).limit(25);
    for (const row of bySite || []) {
      const host = hostnameDomain(row.website);
      if (host === domain || host.endsWith(`.${domain}`)) companyIds.add(row.id);
    }
  }

  const primaryCompany =
    hint?.companyId ||
    ownedCompanies?.[0]?.id ||
    [...companyIds][0] ||
    null;

  return { companyIds: [...companyIds], profileIds: ids, email, companyId: primaryCompany };
}

export async function getFoundingStatus(profileId: string, hint?: StartPackHint): Promise<StartPackStatus> {
  if (!supabaseAdmin) {
    return emptyStartPack("not_configured");
  }
  if (!isFoundingLaunchEnabled()) {
    return emptyStartPack("launch_closed");
  }

  const cluster = await loadStartPackCluster(profileId, hint);
  const { data: myCompany } = cluster.companyId
    ? await supabaseAdmin
        .from("companies")
        .select("id,founding_expires_at")
        .eq("id", cluster.companyId)
        .maybeSingle()
    : await supabaseAdmin
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

  const filters: string[] = [];
  if (cluster.profileIds.length > 0) filters.push(`created_by.in.(${cluster.profileIds.join(",")})`);
  if (cluster.companyIds.length > 0) filters.push(`company_id.in.(${cluster.companyIds.join(",")})`);
  const jobQuery = supabaseAdmin
    .from("jobs")
    .select("id,created_by,company_id,origin,plan_price,stripe_payment_status,company_description");
  const { data: jobs } = filters.length > 0 ? await jobQuery.or(filters.join(",")) : await jobQuery.eq("created_by", profileId);
  const merged = new Map<string, StartPackJobRow>();
  for (const job of (jobs || []) as StartPackJobRow[]) merged.set(job.id, job);
  const nameKey = normalizeCompanyKey(hint?.companyName);
  if (nameKey && hint?.companyName) {
    const nameQuery = hint.companyName.trim().replace(/[%_,()]/g, " ").slice(0, 80);
    const { data: namedJobs } = await supabaseAdmin
      .from("jobs")
      .select("id,created_by,company_id,origin,plan_price,stripe_payment_status,company_description")
      .ilike("company_description", `${nameQuery}%`)
      .limit(100);
    for (const job of (namedJobs || []) as Array<StartPackJobRow & { company_description?: string | null }>) {
      if (normalizeCompanyKey((job.company_description || "").split("\n")[0]) === nameKey) merged.set(job.id, job);
    }
  }

  const liveUsage = startPackUsage({ jobs: [...merged.values()], profileId });
  const ledger = await startPackLedgerCounts(supabaseAdmin, {
    email: cluster.email,
    companyId: myCompany?.id || cluster.companyId || hint?.companyId || null,
    companyName: hint?.companyName || null,
  });
  const usage = mergeStartPackUsage(liveUsage, ledger);
  const base = {
    enabled: true,
    remainingSlots,
    remainingJobs: usage.remainingJobs,
    usedJobs: usage.usedJobs,
    quota: usage.quota,
    nextPrice: START_PACK_NEXT_PRICE,
    companyId: myCompany?.id || cluster.companyId || null,
  };

  if (!alreadyFounding && remainingSlots <= 0) {
    return { ...base, eligible: false, reason: "no_slots" };
  }
  if (usage.remainingJobs <= 0) {
    return { ...base, remainingJobs: 0, eligible: false, reason: usage.reason === "account_cap" ? "account_cap" : "company_cap" };
  }

  return {
    ...base,
    eligible: true,
    reason: alreadyFounding ? "founding_member" : "open",
  };
}
