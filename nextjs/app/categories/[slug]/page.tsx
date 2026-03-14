import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_HUBS, getCategoryHub } from "../../../lib/categories";
import { createJobSlug } from "../../../lib/jobs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../lib/supabaseJobs";
import type { Job } from "../../../types";

type PageProps = {
  params: { slug: string };
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

async function fetchPublishedJobsForHub(hubSlug: string): Promise<{ hubLabel: string; intro: string; jobs: Job[]; preference: string } | null> {
  const hub = getCategoryHub(hubSlug);
  if (!hub) return null;

  if (!supabaseAdmin) {
    return { hubLabel: hub.label, intro: hub.intro, jobs: [], preference: hub.dbCategories[0] || "All" };
  }

  const { data } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
    )
    .eq("status", "published")
    .in("category", hub.dbCategories)
    .order("timestamp", { ascending: false })
    .range(0, 59);

  const jobs = (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
  return { hubLabel: hub.label, intro: hub.intro, jobs, preference: hub.dbCategories[0] || "All" };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const hub = getCategoryHub(params.slug);
  if (!hub) return {};

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/categories/${hub.slug}`;
  const title = `${hub.label} roles — CareersPal`;
  // Keep copy neutral: DB taxonomy may be broader than the slug (especially TEMP mappings).
  const description =
    hub.temporaryMappingNote
      ? `Browse published roles under a broad category mapping for ${hub.label}.`
      : `Browse published remote ${hub.label} roles on CareersPal.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: PageProps) {
  const result = await fetchPublishedJobsForHub(params.slug);
  if (!result) notFound();

  const { hubLabel, intro, jobs, preference } = result;
  const hub = getCategoryHub(params.slug)!;

  return (
    <div className="bg-[#F8F9FD] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/categories" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700">
            <span aria-hidden="true">←</span> Categories
          </Link>
          <Link
            href={`/jobs?category=${encodeURIComponent(preference)}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
          >
            Browse on board →
          </Link>
        </div>

        <div className="mt-6 rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="p-6 sm:p-10 border-b border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Category</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{hubLabel}</h1>
            <p className="mt-3 text-slate-700 font-medium max-w-3xl">{intro}</p>

            {hub.temporaryMappingNote && (
              <p className="mt-4 text-xs text-slate-500 font-medium max-w-3xl">
                Note: this category currently uses a broader internal taxonomy mapping.
              </p>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-7 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black"
              >
                Browse jobs
              </Link>
              <Link
                href={`/alerts?category=${encodeURIComponent(hub.slug)}`}
                className="inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
              >
                Get alerts
              </Link>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Live roles</h2>
              {jobs.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {jobs.length} role{jobs.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {jobs.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
                <p className="text-slate-900 font-black text-lg">No live roles in this category right now.</p>
                <p className="mt-2 text-slate-600 font-medium">
                  Browse the job board or get alerts for new roles as they’re published.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/jobs"
                    className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-7 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700"
                  >
                    Browse jobs →
                  </Link>
                  <Link
                    href={`/alerts?category=${encodeURIComponent(hub.slug)}`}
                    className="inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Get alerts →
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {jobs.map((job) => {
                  const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
                  const desc = plainText(job.description || "");
                  const snippet = desc.length > 140 ? `${desc.slice(0, 140).trim()}…` : desc;
                  return (
                    <li
                      key={job.id}
                      className="rounded-3xl border border-slate-200/60 bg-white px-5 py-5 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={href} className="block text-base sm:text-lg font-black text-slate-900 hover:text-indigo-700">
                            {job.title}
                          </Link>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-slate-600">
                            <span className="truncate">{job.company}</span>
                            <span className="text-slate-300">•</span>
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
                          {snippet && (
                            <div className="mt-3 text-sm text-slate-600 font-medium leading-relaxed">
                              {snippet}
                            </div>
                          )}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

