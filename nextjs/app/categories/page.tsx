import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_HUBS, jobMatchesHub } from "../../lib/categories";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { applyLiveBoardFilter } from "../../lib/liveBoard";
import { isOnNicheJob } from "../../lib/nicheScope";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";

const getBaseUrl = () => getCanonicalSiteUrl();

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/categories`;
  const title = "Categories — CareersPal";
  const description =
    "Browse roles by category: Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.";

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export const dynamic = "force-dynamic";

async function fetchLiveCounts(): Promise<Record<string, number>> {
  const sb = supabaseAdmin;
  if (!sb) return {};

  const { data } = await applyLiveBoardFilter(
    sb.from("jobs").select("id,title,category,timestamp").eq("status", "published"),
  ).range(0, 499);

  const jobs = (data || []).filter((job) => isOnNicheJob(job));
  const counts: Record<string, number> = {};
  for (const hub of CATEGORY_HUBS) {
    counts[hub.slug] = jobs.filter((job) => jobMatchesHub(job, hub)).length;
  }
  return counts;
}

export default async function CategoriesPage() {
  const counts = await fetchLiveCounts();

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Categories</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Browse by category
            </h1>
            <p className="mt-3 text-slate-700 font-medium max-w-2xl">
              Published roles grouped the way people actually search this board.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black"
            >
              Browse jobs
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORY_HUBS.map((hub) => {
            const href = `/categories/${hub.slug}`;
            const live = counts[hub.slug];
            const showCount = typeof live === "number" && live > 0;
            return (
              <Link
                key={hub.slug}
                href={href}
                className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-300 transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-black text-slate-900 truncate">{hub.label}</div>
                    <div className="mt-2 text-sm text-slate-600 font-medium leading-relaxed">
                      {hub.intro}
                    </div>
                  </div>
                  {showCount && (
                    <span className="flex-shrink-0 inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {live} live
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

