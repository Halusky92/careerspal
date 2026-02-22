import Link from "next/link";
import JobsClient from "./JobsClient";
import { Job } from "../../types";
import { createJobSlug } from "../../lib/jobs";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../lib/supabaseJobs";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const getParam = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

async function fetchPublishedJobs(): Promise<{ jobs: Job[]; total: number }> {
  if (!supabaseAdmin) return { jobs: [], total: 0 };

  const publishedCutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const publishedCutoffIso = new Date(publishedCutoffMs).toISOString();

  const query = supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description,verified)",
      { count: "exact" },
    )
    .eq("status", "published")
    .or(`timestamp.gte.${publishedCutoffMs},published_at.gte.${publishedCutoffIso},created_at.gte.${publishedCutoffIso}`)
    .order("timestamp", { ascending: false })
    .range(0, 199);

  const { data, count } = await query;
  const mapped = (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
  return { jobs: mapped, total: typeof count === "number" ? count : mapped.length };
}

function StaticJobsList({ jobs, total }: { jobs: Job[]; total: number }) {
  const preview = jobs.slice(0, 20);
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
                      <span className="text-slate-300">•</span>
                      <span className="truncate">{job.type}</span>
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
                      {job.salary || "Salary listed"}
                    </span>
                    {showApply ? (
                      <a
                        href={applyUrl}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer nofollow" : undefined}
                        className="h-11 px-5 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100 whitespace-nowrap inline-flex items-center"
                      >
                        Quick apply
                      </a>
                    ) : (
                      <span className="h-11 px-5 rounded-2xl bg-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-widest whitespace-nowrap inline-flex items-center">
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
  const initialQuery = getParam(searchParams?.query);
  const initialLocation = getParam(searchParams?.location);
  const { jobs, total } = await fetchPublishedJobs();

  return (
    <div className="pt-6">
      <StaticJobsList jobs={jobs} total={total} />
      <JobsClient
        initialJobs={jobs}
        initialTotal={total}
        initialQuery={initialQuery}
        initialLocation={initialLocation}
      />
    </div>
  );
}
