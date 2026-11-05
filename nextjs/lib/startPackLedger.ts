import type { SupabaseClient } from "@supabase/supabase-js";
import { FOUNDING_JOBS_PER_COMPANY } from "./founding";
import { startPackUsage, type StartPackJobRow } from "./startPackQuota";
import { normalizeCompanyKey, workEmailDomain } from "./workEmailDomain";

export type StartPackLedgerRow = {
  email?: string | null;
  work_domain?: string | null;
  company_key?: string | null;
  company_id?: string | null;
  profile_id?: string | null;
  job_id?: string | null;
};

export async function recordStartPackLedger(
  sb: SupabaseClient<any, "public", any>,
  input: {
    email?: string | null;
    companyId?: string | null;
    companyName?: string | null;
    profileId?: string | null;
    jobId?: string | null;
  },
) {
  const email = (input.email || "").trim().toLowerCase();
  const row = {
    email: email || null,
    work_domain: workEmailDomain(email) || null,
    company_key: normalizeCompanyKey(input.companyName) || null,
    company_id: input.companyId || null,
    profile_id: input.profileId || null,
    job_id: input.jobId || null,
  };
  if (!row.job_id && !row.email && !row.company_key && !row.company_id) return;
  try {
    if (row.job_id) {
      await sb.from("start_pack_ledger").delete().eq("job_id", row.job_id);
    }
    await sb.from("start_pack_ledger").insert(row);
  } catch {
    // Table may not exist yet; posting should still succeed.
  }
}

export async function snapshotStartPackLedgerForProfile(
  sb: SupabaseClient<any, "public", any>,
  profileId: string,
  email?: string | null,
) {
  const { data: jobs } = await sb
    .from("jobs")
    .select("id,created_by,company_id,origin,plan_price,stripe_payment_status,company_description")
    .eq("created_by", profileId);
  for (const job of (jobs || []) as Array<StartPackJobRow & { company_description?: string | null }>) {
    if (job.plan_price !== 0 && job.stripe_payment_status !== "founding") continue;
    await recordStartPackLedger(sb, {
      email,
      companyId: job.company_id,
      companyName: (job.company_description || "").split("\n")[0],
      profileId,
      jobId: job.id,
    });
  }
}

export async function startPackLedgerCounts(
  sb: SupabaseClient<any, "public", any>,
  hint: { email?: string | null; companyId?: string | null; companyName?: string | null },
) {
  const email = (hint.email || "").trim().toLowerCase();
  const domain = workEmailDomain(email);
  const companyKey = normalizeCompanyKey(hint.companyName);
  let byEmail = 0;
  let byCompany = 0;
  let byDomain = 0;
  try {
    if (email) {
      const { count, error } = await sb.from("start_pack_ledger").select("id", { count: "exact", head: true }).eq("email", email);
      if (error) return { byEmail: 0, byCompany: 0, byDomain: 0 };
      byEmail = typeof count === "number" ? count : 0;
    }
    if (hint.companyId) {
      const { count } = await sb
        .from("start_pack_ledger")
        .select("id", { count: "exact", head: true })
        .eq("company_id", hint.companyId);
      byCompany = Math.max(byCompany, typeof count === "number" ? count : 0);
    }
    if (companyKey) {
      const { count } = await sb
        .from("start_pack_ledger")
        .select("id", { count: "exact", head: true })
        .eq("company_key", companyKey);
      byCompany = Math.max(byCompany, typeof count === "number" ? count : 0);
    }
    if (domain) {
      const { count } = await sb
        .from("start_pack_ledger")
        .select("id", { count: "exact", head: true })
        .eq("work_domain", domain);
      byDomain = typeof count === "number" ? count : 0;
    }
  } catch {
    return { byEmail: 0, byCompany: 0, byDomain: 0 };
  }
  return { byEmail, byCompany, byDomain };
}

export function mergeStartPackUsage(
  live: ReturnType<typeof startPackUsage>,
  ledger: { byEmail: number; byCompany: number; byDomain: number },
  quota = FOUNDING_JOBS_PER_COMPANY,
) {
  const accountUsed = Math.max(live.accountUsed, ledger.byEmail);
  const companyUsed = Math.max(live.companyUsed, ledger.byCompany, ledger.byDomain);
  const remainingJobs = Math.max(0, Math.min(quota - accountUsed, quota - companyUsed));
  const usedJobs = quota - remainingJobs;
  const reason =
    accountUsed >= quota ? "account_cap" : companyUsed >= quota ? "company_cap" : live.reason;
  return { ...live, accountUsed, companyUsed, remainingJobs, usedJobs, quota, reason };
}
