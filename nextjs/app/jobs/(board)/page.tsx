import type { Metadata } from "next";
import Link from "next/link";
import JobsClient from "../JobsClient";
import { getCanonicalSiteUrl } from "../../../lib/alerts/siteUrl";
import { Job } from "../../../types";
import { createJobSlug } from "../../../lib/jobs";
import { formatJobSalary } from "../../../lib/formatSalary";
import { ApplyClickLink } from "../../../components/JobAnalytics";
import { boardAccessHeadline, boardCap, boardCompanyCount, lockedBoardPreviews } from "../../../lib/boardAccess";
import { listingsForViewer } from "../../../lib/listingWindow";
import { viewerTier } from "../../../lib/viewerTier";
import { categoryCountsForJobs } from "../../../lib/categories";
import { filterAndSortBoard, filtersFromSearchParams, pageBoard, boardFilterKey, boardFacets } from "../../../lib/boardListQuery";
import { getBoardCatalog } from "../../../lib/publicBoardCatalog";

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

async function fetchPublishedJobs(filters: ReturnType<typeof filtersFromSearchParams>): Promise<{ jobs: Job[]; catalog: Job[] }> {
  try {
    const catalog = await getBoardCatalog();
    return { catalog, jobs: filterAndSortBoard(catalog, filters) };
  } catch {
    return { jobs: [], catalog: [] };
  }
}

function StaticJobsList({ jobs, total, companies }: { jobs: Job[]; total: number | null; companies: number }) {
  const preview = jobs;
  const headline = boardAccessHeadline("guest", total, companies);
  return (
    <section className="cp-static-jobs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Jobs</div>
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {typeof total === "number" && total > 0 ? `${total} roles` : "Roles reviewed daily"}
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

        {typeof total === "number" && total > preview.length && (
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">{headline}</div>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function JobsPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const filters = filtersFromSearchParams(params);
  const initialQuery = filters.query || getParam(params.query);
  const initialLocation = filters.location || getParam(params.location);
  const [loaded, tier] = await Promise.all([fetchPublishedJobs(filters), viewerTier()]);
  const catalog = listingsForViewer(loaded.catalog, tier);
  const jobs = listingsForViewer(loaded.jobs, tier);
  const total = jobs.length;
  const page = pageBoard(jobs, 0);
  const initialJobs = page.jobs;
  const initialLocked = lockedBoardPreviews(jobs, boardCap(tier));
  const categoryTotals = categoryCountsForJobs(jobs);
  const initialFacets = boardFacets(catalog, filters);

  return (
    <div className="pt-3">
      <style>{`html.cp-restore-jobs body{visibility:hidden}`}</style>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var p=JSON.parse(sessionStorage.getItem("cp_jobs_return")||"null");if(p&&p.scrollY>0)document.documentElement.classList.add("cp-restore-jobs")}catch(e){}`,
        }}
      />
      <noscript>
        <StaticJobsList jobs={initialJobs} total={total} companies={boardCompanyCount(jobs)} />
      </noscript>
      <JobsClient
        initialJobs={initialJobs}
        initialLocked={initialLocked}
        initialCompanies={boardCompanyCount(jobs)}
        initialAccess={tier}
        initialTotal={total}
        initialCategoryTotals={categoryTotals}
        initialFacets={initialFacets}
        initialQuery={initialQuery}
        initialLocation={initialLocation}
        initialFilterKey={boardFilterKey(filters)}
      />
    </div>
  );
}
