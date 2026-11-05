import Link from "next/link";
import HomeClient from "./HomeClient";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../lib/supabaseJobs";
import { isOnNicheJob } from "../lib/nicheScope";
import { applyLiveBoardFilter } from "../lib/liveBoard";
import { formatJobSalary } from "../lib/formatSalary";
import { getPublicSubscriberCount } from "../lib/countAlertSubscribers";

export const dynamic = "force-dynamic";

const planWeight = { "Elite Managed": 3, "Featured Pro": 2, Standard: 1 };

async function fetchPublishedJobs(): Promise<Job[]> {
  if (!supabaseAdmin) return [];

  const query = applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
      )
      .eq("status", "published"),
  )
    .order("timestamp", { ascending: false })
    .range(0, 499);

  const { data } = await query;
  return (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob).filter((job) => isOnNicheJob(job));
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

export default async function HomePage() {
  const jobs = await fetchPublishedJobs();
  const subscriberCount = await getPublicSubscriberCount();
  return (
    <>
      <StaticHomeJobs jobs={jobs} />
      <HomeClient initialJobs={jobs} subscriberCount={subscriberCount} />
    </>
  );
}
