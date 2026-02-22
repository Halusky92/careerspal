import Link from "next/link";
import HomeClient from "./HomeClient";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../lib/supabaseJobs";

export const dynamic = "force-dynamic";

const planWeight = { "Elite Managed": 3, "Featured Pro": 2, Standard: 1 };

async function fetchPublishedJobs(): Promise<Job[]> {
  if (!supabaseAdmin) return [];

  const publishedCutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const publishedCutoffIso = new Date(publishedCutoffMs).toISOString();

  const query = supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description,verified)",
    )
    .eq("status", "published")
    .or(`timestamp.gte.${publishedCutoffMs},published_at.gte.${publishedCutoffIso},created_at.gte.${publishedCutoffIso}`)
    .order("timestamp", { ascending: false })
    .range(0, 199);

  const { data } = await query;
  return (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
}

function StaticHomeJobs({ jobs }: { jobs: Job[] }) {
  const top = [...jobs]
    .sort((a, b) => {
      const weightA = planWeight[a.planType || "Standard"] || 1;
      const weightB = planWeight[b.planType || "Standard"] || 1;
      if (weightA !== weightB) return weightB - weightA;
      return (b.timestamp ?? 0) - (a.timestamp ?? 0);
    })
    .slice(0, 8);

  return (
    <section className="cp-static-jobs hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">Latest roles</div>
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {jobs.length > 0 ? `${jobs.length} live roles` : "Roles reviewed daily"}
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {top.map((job) => {
            const href = `/jobs/${createJobSlug({ id: job.id, title: job.title })}`;
            return (
              <li key={job.id} className="rounded-3xl border border-amber-200/80 bg-amber-50/70 px-4 py-4 sm:px-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={href} className="block truncate text-base sm:text-lg font-black text-slate-900">
                      {job.title}
                    </Link>
                    <div className="mt-1 text-[12px] font-bold text-slate-600 truncate">
                      {job.company} • {job.location}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[12px] sm:text-sm font-black text-slate-900 whitespace-nowrap">
                      {job.salary || "Salary listed"}
                    </span>
                    <span className="h-11 px-5 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest whitespace-nowrap inline-flex items-center">
                      Quick apply
                    </span>
                  </div>
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
  return (
    <>
      <StaticHomeJobs jobs={jobs} />
      <HomeClient initialJobs={jobs} />
    </>
  );
}
