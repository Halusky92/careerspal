import type { Metadata } from "next";
import Link from "next/link";
import JobsClient from "./JobsClient";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";
import { Job } from "../../types";
import { createJobSlug } from "../../lib/jobs";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../lib/supabaseJobs";
import { isOnNicheJob } from "../../lib/nicheScope";
import { applyLiveBoardFilter } from "../../lib/liveBoard";
import { formatJobSalary } from "../../lib/formatSalary";
import { ApplyClickLink } from "../../components/JobAnalytics";
import { applyBoardVisibility, boardCompanyCount, GUEST_VISIBLE_JOBS, lockedBoardPreviews } from "../../lib/boardAccess";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const canonicalUrl = `${getCanonicalSiteUrl()}/jobs`;
  const title = "Ops jobs with salary — CareersPal";
  const description =
    "Browse live Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles. Salary on every listing.";
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

async function fetchPublishedJobs(): Promise<{ jobs: Job[]; total: number }> {
  if (!supabaseAdmin) return { jobs: [], total: 0 };

  const query = applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
        { count: "exact" },
      )
      .eq("status", "published"),
  )
    .order("timestamp", { ascending: false })
    .range(0, 499);

  const { data, count } = await query;
  const mapped = (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob).filter((job) => isOnNicheJob(job));
  return { jobs: mapped, total: mapped.length };
}

function StaticJobsList({ jobs, total }: { jobs: Job[]; total: number }) {
  const preview = jobs.slice(0, 4);
  return (
    <section className="cp-static-jobs hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Jobs</div>
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {total > 0 ? `${total} roles` : "Roles reviewed daily"}
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {preview.map((job) => {
            const href = `/jobs/${createJobSlug({ id: job.id, title: job.title })}`;
            const applyUrl = job.applyUrl || "#";
            const isExternal =
              applyUrl !== "#" && !applyUrl.startsWith("/") && !applyUrl.startsWith("mailto:");
            const showApply = applyUrl !== "#";
            return (
              <li
                key={job.id}
                className="rounded-3xl border border-amber-200/80 bg-amber-50/70 px-4 py-4 sm:px-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={href}
                      className="block truncate text-base sm:text-lg font-black text-slate-900 hover:text-indigo-600"
                    >
                      {job.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-slate-600">
                      <span className="truncate">{job.company}</span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate">{job.location}</span>
                      {job.type && job.type !== "Unknown" ? (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="truncate">{job.type}</span>
                        </>
                      ) : null}
                      {job.companyVerified && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                            Verified
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[12px] sm:text-sm font-black text-slate-900 whitespace-nowrap">
                      {formatJobSalary(job)}
                    </span>
                    {showApply ? (
                      <ApplyClickLink
                        jobId={job.id}
                        href={applyUrl}
                        external={isExternal}
                        className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors whitespace-nowrap inline-flex items-center"
                      >
                        Apply
                      </ApplyClickLink>
                    ) : (
                      <span className="h-9 px-4 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium whitespace-nowrap inline-flex items-center">
                        Details
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {total > preview.length && (
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">
              Showing {preview.length} of {total}. Full board loads with JavaScript enabled.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function JobsPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const initialQuery = getParam(params.query);
  const initialLocation = getParam(params.location);
  const { jobs, total } = await fetchPublishedJobs();
  const capsOn = process.env.BOARD_PREMIUM_CAPS === "1";
  const ranked = applyBoardVisibility(jobs, null);
  const initialJobs = capsOn ? ranked.slice(0, GUEST_VISIBLE_JOBS) : ranked.slice(0, 50);
  const initialLocked = lockedBoardPreviews(ranked, capsOn ? GUEST_VISIBLE_JOBS : null);

  return (
    <div className="pt-3">
      <StaticJobsList jobs={initialJobs} total={total} />
      <JobsClient
        initialJobs={initialJobs}
        initialLocked={initialLocked}
        initialCompanies={boardCompanyCount(ranked)}
        initialAccess={capsOn ? "guest" : "paid"}
        initialTotal={total}
        initialQuery={initialQuery}
        initialLocation={initialLocation}
      />
    </div>
  );
}
