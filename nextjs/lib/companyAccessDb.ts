import type { SupabaseClient } from "@supabase/supabase-js";
import { adminMayApprove, canPostForCompany, decideAccessRequest, type CompanyMembership, type CompanyRole } from "./companyAccess";
import { classifyCompanyMatch, type CompanyMatchCandidate } from "./companyMatch";
import { applyUrlAtsId, canonicalApplyUrl, classifyJobDuplicate, type ExistingJobIdentity } from "./jobDuplicate";
import { emailDomain } from "./workEmailDomain";

type Db = SupabaseClient<any, "public", any>;

export function relationMissing(error: { code?: string; message?: string } | null | undefined) {
  const code = error?.code || "";
  const message = error?.message || "";
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message);
}

export async function membershipTableReady(sb: Db) {
  const probe = await sb.from("company_memberships").select("id").limit(1);
  return !probe.error;
}

export async function loadMembership(sb: Db, companyId: string, profileId: string): Promise<CompanyMembership | null> {
  const { data, error } = await sb
    .from("company_memberships")
    .select("role,status")
    .eq("company_id", companyId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  return { role: data.role as CompanyRole, status: data.status === "revoked" ? "revoked" : "active" };
}

export async function matchExistingCompany(
  sb: Db,
  input: { name?: string | null; website?: string | null },
) {
  const name = (input.name || "").trim();
  if (name.length < 2 && !(input.website || "").trim()) return { status: "none" as const, match: classifyCompanyMatch(input, []) };
  const { data, error } = await sb.from("companies").select("id,name,website").range(0, 999);
  const rows = error ? [] : ((data || []) as { id: string; name: string; website?: string | null }[]);
  let aliases: { company_id: string; kind: string; value: string; status: string }[] = [];
  const aliasQuery = await sb.from("company_aliases").select("company_id,kind,value,status").eq("status", "verified").limit(200);
  if (!aliasQuery.error) aliases = (aliasQuery.data || []) as typeof aliases;
  const sources = await sb.from("sourcing_sources").select("company_id,ats_identifier").not("company_id", "is", null).limit(300);
  const sourceRows = sources.error ? [] : ((sources.data || []) as { company_id: string; ats_identifier?: string | null }[]);
  const byId = new Map<string, CompanyMatchCandidate>();
  for (const row of rows) byId.set(row.id, { id: row.id, name: row.name, website: row.website, domains: [], aliases: [], atsIdentifiers: [] });
  for (const alias of aliases) {
    if (!byId.has(alias.company_id) && alias.kind === "name" && name && alias.value.toLowerCase() === name.toLowerCase()) {
      const company = await sb.from("companies").select("id,name,website").eq("id", alias.company_id).maybeSingle();
      if (company.data?.id) byId.set(company.data.id, { id: company.data.id, name: company.data.name, website: company.data.website, domains: [], aliases: [], atsIdentifiers: [] });
    }
    const candidate = byId.get(alias.company_id);
    if (!candidate) continue;
    if (alias.kind === "domain") candidate.domains = [...(candidate.domains || []), alias.value];
    if (alias.kind === "name") candidate.aliases = [...(candidate.aliases || []), alias.value];
    if (alias.kind === "ats") candidate.atsIdentifiers = [...(candidate.atsIdentifiers || []), alias.value];
  }
  for (const source of sourceRows) {
    const candidate = byId.get(source.company_id);
    if (!candidate || !source.ats_identifier) continue;
    candidate.atsIdentifiers = [...(candidate.atsIdentifiers || []), source.ats_identifier];
  }
  return { status: "ready" as const, match: classifyCompanyMatch(input, [...byId.values()]) };
}

export async function findJobConflict(
  sb: Db,
  input: { applyUrl?: string | null; title?: string | null; location?: string | null; companyId?: string | null },
) {
  const existing: ExistingJobIdentity[] = [];
  const apply = (input.applyUrl || "").trim();
  if (apply) {
    const jobs = await sb.from("jobs").select("id,title,location,company_id,apply_url").eq("apply_url", apply).limit(5);
    for (const row of jobs.data || []) existing.push({ id: row.id, title: row.title, location: row.location, companyId: row.company_id, applyUrl: row.apply_url });
    const path = canonicalApplyUrl(apply).split("?")[0];
    if (path.length >= 12) {
      const nearby = await sb.from("jobs").select("id,title,location,company_id,apply_url").ilike("apply_url", `%${path}%`).limit(40);
      for (const row of nearby.data || []) {
        existing.push({ id: row.id, title: row.title, location: row.location, companyId: row.company_id, applyUrl: row.apply_url, atsId: applyUrlAtsId(row.apply_url) });
      }
    }
    const candidates = await sb
      .from("sourcing_sourced_job_candidates")
      .select("published_job_id,title,location_text,apply_url,external_job_id")
      .eq("apply_url", apply)
      .not("published_job_id", "is", null)
      .limit(5);
    for (const row of candidates.data || []) {
      if (!row.published_job_id) continue;
      existing.push({
        id: row.published_job_id,
        title: row.title,
        location: row.location_text,
        companyId: input.companyId,
        applyUrl: row.apply_url,
        atsId: row.external_job_id,
      });
    }
  }
  if (input.companyId && input.title) {
    const sameCompany = await sb.from("jobs").select("id,title,location,company_id,apply_url").eq("company_id", input.companyId).ilike("title", input.title).limit(8);
    for (const row of sameCompany.data || []) {
      existing.push({ id: row.id, title: row.title, location: row.location, companyId: row.company_id, applyUrl: row.apply_url });
    }
  }
  return classifyJobDuplicate(input, existing);
}

export async function createAccessRequest(
  sb: Db,
  input: {
    companyId: string;
    profileId: string;
    email: string;
    emailVerified: boolean;
    companyWebsite?: string | null;
    verifiedDomains?: string[];
    evidence?: string | null;
    matchKind?: string | null;
  },
) {
  if (!(await membershipTableReady(sb))) return { error: "save_failed", request: null };
  const member = await loadMembership(sb, input.companyId, input.profileId);
  const decision = decideAccessRequest({
    email: input.email,
    emailVerified: input.emailVerified,
    freeListing: false,
    companyWebsite: input.companyWebsite,
    verifiedDomains: input.verifiedDomains,
    alreadyMember: canPostForCompany(member),
  });
  if (!decision.ok) return { error: decision.code, request: null };
  const inserted = await sb
    .from("company_access_requests")
    .insert({
      company_id: input.companyId,
      profile_id: input.profileId,
      email: input.email,
      email_domain: emailDomain(input.email),
      email_verified: input.emailVerified,
      match_kind: input.matchKind || null,
      status: "pending_review",
      evidence: (input.evidence || "").trim() || null,
    })
    .select("id,status")
    .single();
  if (inserted.error || !inserted.data) return { error: "save_failed", request: null };
  await sb.from("audit_logs").insert({
    action: "company_access_requested",
    actor_id: input.profileId,
    metadata: { requestId: inserted.data.id, companyId: input.companyId, manual: decision.manual },
  });
  return { error: null, request: inserted.data };
}

export async function reviewAccessRequest(
  sb: Db,
  input: { requestId: string; adminId: string; action: "approve" | "reject" | "revoke"; role?: CompanyRole; note?: string | null },
) {
  const { data: request, error } = await sb
    .from("company_access_requests")
    .select("id,company_id,profile_id,email,email_verified,evidence,status")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !request) return { error: "not_found" as const };
  const company = await sb.from("companies").select("id,website").eq("id", request.company_id).maybeSingle();
  if (input.action === "approve") {
    const allowed = adminMayApprove({
      email: request.email,
      emailVerified: Boolean(request.email_verified),
      companyWebsite: company.data?.website,
      evidence: request.evidence,
    });
    if (!allowed.ok) return { error: allowed.reason };
    const role = input.role === "admin" ? "admin" : "poster";
    const saved = await sb.from("company_memberships").upsert(
      {
        company_id: request.company_id,
        profile_id: request.profile_id,
        role,
        status: "active",
        granted_by: input.adminId,
        revoked_at: null,
      },
      { onConflict: "company_id,profile_id" },
    );
    if (saved.error) return { error: "save_failed" as const };
  }
  if (input.action === "revoke") {
    await sb
      .from("company_memberships")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("company_id", request.company_id)
      .eq("profile_id", request.profile_id);
  }
  const status = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "revoked";
  await sb
    .from("company_access_requests")
    .update({
      status,
      reviewed_by: input.adminId,
      reviewed_at: new Date().toISOString(),
      decision_note: (input.note || "").trim() || null,
    })
    .eq("id", request.id);
  await sb.from("audit_logs").insert({
    action: `company_access_${status}`,
    actor_id: input.adminId,
    metadata: { requestId: request.id, companyId: request.company_id, profileId: request.profile_id },
  });
  return { error: null, status };
}
