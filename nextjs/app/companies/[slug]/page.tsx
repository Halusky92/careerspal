import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompanyLogo from "../../../components/CompanyLogo";
import { createCompanySlug, createJobSlug } from "../../../lib/jobs";
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

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id,name,slug,website,description,logo_url,location,verified")
    .eq("slug", slug)
    .maybeSingle();

  if (!company) return null;

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description,verified)",
    )
    .eq("company_id", company.id)
    .eq("status", "published")
    .order("timestamp", { ascending: false });

  const mappedJobs = (jobs as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
  return { company: company as SupabaseCompanyRow, jobs: mappedJobs };
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
  const showVerified = Boolean(company.verified);

  return (
    <div className="bg-[#F8F9FD] pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/companies" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700">
            <span aria-hidden="true">←</span> Companies
          </Link>
          <Link
            href={jobs.length > 0 ? `/jobs?query=${encodeURIComponent(companyName)}` : "/jobs"}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
          >
            Browse jobs →
          </Link>
        </div>

        <div className="mt-6 rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="p-6 sm:p-10 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-white border border-slate-200/70 p-1 flex-shrink-0">
                <CompanyLogo
                  name={companyName}
                  logoUrl={company.logo_url}
                  website={companyWebsite || undefined}
                  className="w-full h-full rounded-xl overflow-hidden bg-white"
                  imageClassName="w-full h-full object-contain"
                  fallbackClassName="text-[10px]"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {showVerified && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      Verified
                    </span>
                  )}
                  {companyLocation && (
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {companyLocation}
                    </span>
                  )}
                  {jobs.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {jobs.length} live role{jobs.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {companyName}
                </h1>

                {companyWebsite && (
                  <div className="mt-2">
                    <a
                      href={companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-black text-indigo-700 hover:text-indigo-800 hover:underline decoration-indigo-300 underline-offset-2"
                    >
                      {safeHost(companyWebsite)} →
                    </a>
                  </div>
                )}

                {companyDescription && !companyDescription.toLowerCase().includes("coming soon") && (
                  <p className="mt-4 text-slate-700 font-medium leading-relaxed">
                    {companyDescription}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Live roles</h2>
                <p className="mt-2 text-slate-600 font-medium">
                  {jobs.length > 0 ? "Published roles currently live on CareersPal." : "No published roles live right now."}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/post-a-job"
                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                >
                  Post a job
                </Link>
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
          </div>
        </div>
      </div>
    </div>
  );
}
