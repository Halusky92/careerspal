import Link from "next/link";
import HomeClient from "../HomeClient";
import { Job } from "../../types";
import { createJobSlug } from "../../lib/jobs";
import { formatJobSalary } from "../../lib/formatSalary";
import { getPublicSubscriberCount } from "../../lib/countAlertSubscribers";
import { isPriorityListing, listingsForViewer } from "../../lib/listingWindow";
import { isPaidFeaturedListing, sortFeaturedJobs } from "../../lib/featuredListing";
import { isOnNicheJob } from "../../lib/nicheScope";
import { viewerTier } from "../../lib/viewerTier";
import { topHiringEmployers } from "../../lib/companyBoard";
import { getBoardCatalog } from "../../lib/publicBoardCatalog";

export const dynamic = "force-dynamic";

const planWeight = { "Elite Managed": 3, "Featured Pro": 2, Standard: 1 };

async function fetchPublishedJobs(): Promise<Job[]> {
  try {
    return await getBoardCatalog();
  } catch {
    return [];
  }
}

function StaticHomeJobs({ jobs }: { jobs: Job[] }) {
  const top = [...jobs]
    .sort((a, b) => {
      const weightA = planWeight[a.planType || "Standard"] || 1;
      const weightB = planWeight[b.planType || "Standard"] || 1;
      if (weightA !== weightB) return weightB - weightA;
      return (b.timestamp ?? 0) - (a.timestamp ?? 0);
    })
    .slice(0, 4);

  return (
    <section className="cp-static-jobs hidden">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">A few live roles</div>
        <ul className="mt-4 space-y-2">
          {top.map((job) => {
            const href = `/jobs/${createJobSlug({ id: job.id, title: job.title })}`;
            return (
              <li key={job.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <Link href={href} className="block truncate text-sm font-semibold text-slate-900">
                  {job.title}
                </Link>
                <div className="mt-0.5 text-xs text-slate-500 truncate">
                  {job.company} · {formatJobSalary(job)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function selectHomeCards(jobs: Job[], tier: "guest" | "registered" | "paid") {
  const live = jobs.filter((job) => isOnNicheJob(job)).sort((a, b) => {
    const priority = Number(isPriorityListing(b)) - Number(isPriorityListing(a));
    if (priority !== 0) return priority;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
  const featuredTake = tier === "paid" ? 3 : Math.min(3, live.length);
  const featured = sortFeaturedJobs(live.filter(isPaidFeaturedListing)).slice(0, featuredTake);
  const featuredIds = new Set(featured.map((job) => job.id));
  const rest = live.filter((job) => !featuredIds.has(job.id)).slice(0, Math.max(0, 4 - featured.length));
  return [...featured, ...rest];
}

export default async function HomePage() {
  const [loaded, tier, subscriberCount] = await Promise.all([
    fetchPublishedJobs(),
    viewerTier(),
    getPublicSubscriberCount(),
  ]);
  const jobs = listingsForViewer(loaded, tier);
  const liveTotal = jobs.length;
  return (
    <>
      <StaticHomeJobs jobs={jobs} />
      <HomeClient
        initialJobs={selectHomeCards(jobs, tier)}
        initialLiveTotal={liveTotal}
        initialAccess={tier}
        subscriberCount={subscriberCount}
        employers={topHiringEmployers(jobs, 20)}
      />
    </>
  );
}
