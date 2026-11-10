import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryHub, jobMatchesHub } from "../../../lib/categories";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../lib/supabaseJobs";
import type { Job } from "../../../types";
import { isOnNicheJob } from "../../../lib/nicheScope";
import { applyLiveBoardFilter } from "../../../lib/liveBoard";
import BoardCappedJobs from "../../../components/BoardCappedJobs";
import { getCanonicalSiteUrl } from "../../../lib/alerts/siteUrl";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getBaseUrl = () => getCanonicalSiteUrl();

async function fetchPublishedJobsForHub(hubSlug: string): Promise<{ hubLabel: string; intro: string; jobs: Job[]; preference: string } | null> {
  const hub = getCategoryHub(hubSlug);
  if (!hub) return null;

  if (!supabaseAdmin) {
    return { hubLabel: hub.label, intro: hub.intro, jobs: [], preference: hub.dbCategories[0] || "All" };
  }

  const { data } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
      )
      .eq("status", "published"),
  )
    .order("timestamp", { ascending: false })
    .range(0, 499);

  const jobs = (data as SupabaseJobRow[] | null || [])
    .map(mapSupabaseJob)
    .filter((job) => isOnNicheJob(job) && jobMatchesHub(job, hub));
  return { hubLabel: hub.label, intro: hub.intro, jobs, preference: hub.slug };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const hub = getCategoryHub(slug);
  if (!hub) return {};

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/categories/${hub.slug}`;
  const title = `${hub.label} roles — CareersPal`;
  // Keep copy neutral: DB taxonomy may be broader than the slug (especially TEMP mappings).
  const description = `Browse published ${hub.label} roles on CareersPal.`;

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
  const { slug } = await params;
  const result = await fetchPublishedJobsForHub(slug);
  if (!result) notFound();

  const { hubLabel, intro, jobs, preference } = result;
  const hub = getCategoryHub(slug)!;

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
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
              <BoardCappedJobs jobs={jobs} variant="category" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

