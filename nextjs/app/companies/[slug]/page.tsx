import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompanyLogo from "../../../components/CompanyLogo";
import { createCompanySlug, createJobSlug } from "../../../lib/jobs";
import { enrichCompanyFromWebsite } from "../../../lib/companyEnrichment";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../lib/supabaseJobs";
import type { Job } from "../../../types";

type PageProps = {
  params: { slug: string };
};

type SupabaseCompanyRow = {
  id: string;
  name: string | null;
  slug: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  location: string | null;
  verified: boolean | null;
};

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

const plainText = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const safeHost = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw || raw === "#") return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
};

async function fetchCompanyAndJobs(slug: string): Promise<{
  company: SupabaseCompanyRow;
  jobs: Job[];
} | null> {
  if (!supabaseAdmin) return null;

  let { data: company } = await supabaseAdmin
    .from("companies")
    .select("id,name,slug,website,description,logo_url,location,verified")
    .eq("slug", slug)
    .maybeSingle();

  // Self-heal: some records may exist without a slug (legacy / imported / auto-created).
  // Try a conservative fallback lookup by exact name match (case-insensitive) and then set slug.
  if (!company) {
    const nameGuess = slug.replace(/-/g, " ").trim();
    const { data: byName } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,website,description,logo_url,location,verified")
      .ilike("name", nameGuess)
      .maybeSingle();

    if (byName?.id) {
      company = byName as any;
      if (!byName.slug) {
        await supabaseAdmin.from("companies").update({ slug }).eq("id", byName.id);
        company = { ...(company as any), slug } as any;
      }
    }
  }

  if (!company) return null;
  let companyRow = company as SupabaseCompanyRow;

  // Self-heal: if website is missing, derive it from published jobs (company_website or apply_url host).
  try {
    const needsWebsite = !((companyRow.website || "").trim());
    if (needsWebsite) {
      const { data: jobRow } = await supabaseAdmin
        .from("jobs")
        .select("company_website,apply_url")
        .eq("company_id", companyRow.id)
        .eq("status", "published")
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rawWebsite = (jobRow as any)?.company_website || null;
      const rawApply = (jobRow as any)?.apply_url || null;
      const pick = (value: string | null) => {
        const v = (value || "").trim();
        if (!v || v === "#" || v.startsWith("mailto:") || v.startsWith("/")) return null;
        try {
          const u = new URL(v);
          return `${u.protocol}//${u.hostname}`;
        } catch {
          return null;
        }
      };
      const derived = pick(rawWebsite) || pick(rawApply);
      if (derived) {
        await supabaseAdmin.from("companies").update({ website: derived }).eq("id", companyRow.id);
        companyRow = { ...(companyRow as any), website: derived } as SupabaseCompanyRow;
      }
    }
  } catch {
    // ignore
  }

  // Optional enrichment: if company has a website but missing description/logo, fill from meta tags.
  // Conservative: only fills missing fields; failures don't block rendering.
  try {
    const needsDesc = !((companyRow.description || "").trim());
    const needsLogo = !((companyRow.logo_url || "").trim());
    const website = (companyRow.website || "").trim();
    if ((needsDesc || needsLogo) && website) {
      const enr = await enrichCompanyFromWebsite({ websiteUrl: website });
      const patch: Record<string, unknown> = {};
      if (needsDesc && enr.description) patch.description = enr.description;
      if (needsLogo && enr.logo_url) patch.logo_url = enr.logo_url;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("companies").update(patch).eq("id", companyRow.id);
        companyRow = { ...(companyRow as any), ...(patch as any) } as SupabaseCompanyRow;
      }
    }
  } catch {
    // ignore
  }

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
    )
    .eq("company_id", companyRow.id)
    .eq("status", "published")
    .order("timestamp", { ascending: false });

  const mappedJobs = (jobs as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
  return { company: companyRow, jobs: mappedJobs };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchCompanyAndJobs(params.slug);
  if (!result) return {};

  const baseUrl = getBaseUrl();
  const companyName = result.company.name || "Company";
  const canonicalSlug = result.company.slug || createCompanySlug({ name: companyName });
  const canonicalPath = `/companies/${canonicalSlug}`;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  const title = `${companyName} — Remote Ops & Systems roles | CareersPal`;
  const desc = plainText(result.company.description || "").slice(0, 240);
  const description = desc || `Explore live remote roles from ${companyName} on CareersPal.`;

  const imageUrl = result.company.logo_url
    ? result.company.logo_url.startsWith("http")
      ? result.company.logo_url
      : `${baseUrl}${result.company.logo_url}`
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function CompanyPage({ params }: PageProps) {
  const result = await fetchCompanyAndJobs(params.slug);
  if (!result) notFound();

  const { company, jobs } = result;
  const companyName = company.name || "Company";
  const companyWebsite = (company.website || "").trim();
  const companyDescription = (company.description || "").trim();
  const companyLocation = (company.location || "").trim();
  const employeeCount = (company as any).employee_count ? String((company as any).employee_count).trim() : "";
  const showVerified = Boolean(company.verified);

  const stack = Array.from(
    new Set(
      jobs
        .flatMap((j) => (j.tools && j.tools.length > 0 ? j.tools : j.tags || []))
        .map((v) => (v || "").toString().trim())
        .filter(Boolean),
    ),
  ).slice(0, 18);

  const benefits = Array.from(
    new Set(
      jobs
        .flatMap((j) => (j.benefits || []) as string[])
        .map((v) => (v || "").toString().trim())
        .filter(Boolean),
    ),
  ).slice(0, 18);

  return (
    <div className="bg-[#F8F9FD] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700">
            <span aria-hidden="true">←</span> Back to jobs
          </Link>
          <Link
            href="/post-a-job"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-black"
          >
            Post a job
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100">
                <div className="w-20 h-20 rounded-[1.6rem] overflow-hidden bg-white border border-slate-200/70 p-2">
                  <CompanyLogo
                    name={companyName}
                    logoUrl={company.logo_url}
                    website={companyWebsite || undefined}
                    className="w-full h-full rounded-xl overflow-hidden bg-white"
                    imageClassName="w-full h-full object-contain"
                    fallbackClassName="text-[10px]"
                  />
                </div>

                <h1 className="mt-5 text-3xl font-black text-slate-900 tracking-tight">{companyName}</h1>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {showVerified && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      Verified
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Jobs posted: {jobs.length}
                  </span>
                </div>

                <div className="mt-5 space-y-3 text-sm font-bold text-slate-700">
                  {companyLocation && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">HQ</span>
                      <span className="text-slate-900">{companyLocation}</span>
                    </div>
                  )}
                  {employeeCount && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Size</span>
                      <span className="text-slate-900">{employeeCount}</span>
                    </div>
                  )}
                  {companyWebsite && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Website</span>
                      <a
                        href={companyWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-700 hover:text-indigo-800 hover:underline decoration-indigo-300 underline-offset-2"
                      >
                        {safeHost(companyWebsite)}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <a
                    href="#roles"
                    className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100"
                  >
                    View roles →
                  </a>
                  <a
                    href={companyWebsite || "#"}
                    target={companyWebsite ? "_blank" : undefined}
                    rel={companyWebsite ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    {companyWebsite ? "Visit website" : "Website not provided"}
                  </a>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <a href="#about" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                    About
                  </a>
                  {stack.length > 0 && (
                    <a href="#stack" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                      Stack
                    </a>
                  )}
                  {benefits.length > 0 && (
                    <a href="#benefits" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                      Benefits
                    </a>
                  )}
                  <a href="#roles" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                    Roles
                  </a>
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="lg:col-span-8 space-y-6">
            <section id="about" className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-6 sm:p-10">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">About</div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">What they do</h2>
              <p className="mt-4 text-slate-700 font-medium leading-relaxed">
                {companyDescription && !companyDescription.toLowerCase().includes("coming soon")
                  ? companyDescription
                  : "No company description yet. Always verify details on the official company site."}
              </p>
            </section>

            {stack.length > 0 && (
              <section id="stack" className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-6 sm:p-10">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Stack</div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">Tools & keywords seen in roles</h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {stack.map((t) => (
                    <span key={t} className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500 font-medium">
                  Derived from published role descriptions. Not guaranteed for every team.
                </p>
              </section>
            )}

            {benefits.length > 0 && (
              <section id="benefits" className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-6 sm:p-10">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Benefits</div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">Benefits mentioned in roles</h2>
                <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-medium">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-black mt-0.5">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section id="roles" className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-6 sm:p-10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Roles</div>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">All {companyName} roles</h2>
                  <p className="mt-2 text-slate-600 font-medium">
                    {jobs.length > 0 ? "Published roles currently live on CareersPal." : "No published roles live right now."}
                  </p>
                </div>
              </div>

              {jobs.length > 0 ? (
                <ul className="mt-6 space-y-3">
                  {jobs.map((job) => {
                    const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
                    return (
                      <li key={job.id} className="rounded-3xl border border-slate-200/60 bg-white px-5 py-5 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Link href={href} className="block text-base sm:text-lg font-black text-slate-900 hover:text-indigo-700">
                              {job.title}
                            </Link>
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-slate-600">
                              {job.category && <span className="truncate">{job.category}</span>}
                              {job.category && <span className="text-slate-300">•</span>}
                              <span className="truncate">{job.location}</span>
                              <span className="text-slate-300">•</span>
                              <span className="truncate">{job.type}</span>
                              {job.remotePolicy && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate">{job.remotePolicy}</span>
                                </>
                              )}
                              {job.postedAt && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate">Posted {job.postedAt}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-sm font-black text-slate-900 whitespace-nowrap">
                              {job.salary || "Salary listed"}
                            </div>
                            <div className="mt-2">
                              <Link
                                href={href}
                                className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100"
                              >
                                View role →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                  <p className="text-slate-600 font-medium">Browse the job board for other live roles.</p>
                  <div className="mt-4">
                    <Link
                      href="/jobs"
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black"
                    >
                      Browse jobs
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
