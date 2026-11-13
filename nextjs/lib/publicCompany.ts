import { supabaseAdmin } from "./supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "./supabaseJobs";
import type { Company, Job } from "../types";
import { isAtsHostname } from "./companyLogoUrl";
import { isOnNicheJob } from "./nicheScope";
import { applyLiveBoardFilter, isLiveBoardJob } from "./liveBoard";
import { isBoilerplateDescription, isForeignCompanyBlurb } from "./companyBoard";

type CompanyRow = {
  id: string;
  name: string | null;
  slug: string | null;
  website: string | null;
  description: string | null;
  long_description: string | null;
  logo_url: string | null;
  location: string | null;
  employee_count: string | null;
  verified?: boolean | null;
};

export type PublicCompanyPayload = {
  company: Company & { verified?: boolean };
  jobs: Job[];
};

export type PublicCompanyResult =
  | { kind: "ok"; company: Company & { verified?: boolean }; jobs: Job[] }
  | { kind: "not_found" }
  | { kind: "error" };

const COMPANY_FIELDS =
  "id,name,slug,website,description,long_description,logo_url,location,employee_count,verified,updated_at";

const JOB_FIELDS =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,published_at,created_at,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,slug,logo_url,website,description)";

function mapCompany(row: CompanyRow): Company & { verified?: boolean } {
  return {
    name: row.name || "Unknown",
    logo: row.logo_url || "",
    website: row.website || "",
    description: row.description || "",
    longDescription: row.long_description || row.description || "",
    verified: Boolean(row.verified),
    foundedYear: "—",
    employeeCount: row.employee_count || "—",
    headquarters: row.location || "",
    images: [],
    techStack: [],
    socialLinks: {},
  };
}

function pickPublicWebsite(value: string | null) {
  const raw = (value || "").trim();
  if (!raw || raw === "#" || raw.startsWith("mailto:") || raw.startsWith("/")) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (isAtsHostname(url.hostname)) return null;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return null;
  }
}

/** Reads company + live jobs from the DB. Does not fetch the employer website. */
export async function loadPublicCompanyBySlug(slug: string): Promise<PublicCompanyResult> {
  if (!supabaseAdmin) return { kind: "error" };

  let { data: company } = await supabaseAdmin
    .from("companies")
    .select(COMPANY_FIELDS)
    .eq("slug", slug)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!company) {
    const nameGuess = slug.replace(/-/g, " ").trim();
    const { data: byName } = await supabaseAdmin
      .from("companies")
      .select(COMPANY_FIELDS)
      .ilike("name", nameGuess)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byName?.id) {
      company = byName;
      if (!byName.slug) {
        await supabaseAdmin.from("companies").update({ slug }).eq("id", byName.id);
        company = { ...byName, slug };
      }
    }
  }

  if (!company) return { kind: "not_found" };

  const existingHost = (() => {
    try {
      return new URL(String(company.website || "")).hostname;
    } catch {
      return "";
    }
  })();
  const needsWebsite = !String(company.website || "").trim() || Boolean(existingHost && isAtsHostname(existingHost));
  if (needsWebsite) {
    const { data: jobRow } = await supabaseAdmin
      .from("jobs")
      .select("company_website,apply_url")
      .eq("company_id", company.id)
      .eq("status", "published")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    const derived = pickPublicWebsite(jobRow?.company_website || null) || pickPublicWebsite(jobRow?.apply_url || null);
    if (derived) {
      await supabaseAdmin.from("companies").update({ website: derived }).eq("id", company.id);
      company = { ...company, website: derived };
    }
  }

  const name = String(company.name || "").trim();
  const companyIds = new Set<string>([company.id]);
  if (name) {
    const { data: twins } = await supabaseAdmin.from("companies").select("id").ilike("name", name);
    for (const row of twins || []) {
      if (row?.id) companyIds.add(row.id);
    }
  }

  const { data: jobs } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(JOB_FIELDS)
      .in("company_id", [...companyIds].slice(0, 20))
      .eq("status", "published")
      .order("timestamp", { ascending: false }),
  );

  const mappedJobs = ((jobs as SupabaseJobRow[] | null) || [])
    .map(mapSupabaseJob)
    .filter((job) => isOnNicheJob(job) && isLiveBoardJob(job));

  const outCompany = mapCompany(company as CompanyRow);
  const foreign =
    isForeignCompanyBlurb(outCompany.description, outCompany.name) ||
    isForeignCompanyBlurb(outCompany.longDescription, outCompany.name);
  if (
    foreign ||
    isBoilerplateDescription(outCompany.description) ||
    isBoilerplateDescription(outCompany.longDescription)
  ) {
    outCompany.description = "";
    outCompany.longDescription = "";
  }
  const hasRealDesc = Boolean((outCompany.description || "").trim()) && !isBoilerplateDescription(outCompany.description);
  if (!hasRealDesc) {
    outCompany.description = "";
    outCompany.longDescription = "";
    const stableJob = [...mappedJobs].reverse().find((job) => {
      const jobDesc = (job.companyDescription || "").toString().trim();
      return jobDesc && !isBoilerplateDescription(jobDesc) && !isForeignCompanyBlurb(jobDesc, outCompany.name);
    });
    const jobDesc = (stableJob?.companyDescription || "").toString().trim();
    if (jobDesc) {
      outCompany.description = jobDesc;
      outCompany.longDescription = jobDesc;
    }
  }

  return { kind: "ok", company: outCompany, jobs: mappedJobs };
}
