import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_HUBS, categoryAvailability } from "../../lib/categories";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { loadPublishedBoardJobs } from "../../lib/publicJobBoard";
import { viewerTier } from "../../lib/viewerTier";

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

function CategoryIcon({ slug }: { slug: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (slug === "systems") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <rect x="8" y="3" width="8" height="4" rx="1" {...common} />
        <rect x="3" y="17" width="6" height="4" rx="1" {...common} />
        <rect x="15" y="17" width="6" height="4" rx="1" {...common} />
        <path d="M12 7v4M6 17v-3h12v3M12 11v3" {...common} />
      </svg>
    );
  }
  if (slug === "automation") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" {...common} />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" {...common} />
      </svg>
    );
  }
  if (slug === "revops") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" {...common} />
      </svg>
    );
  }
  if (slug === "product-ops") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <rect x="3" y="4" width="18" height="14" rx="2" {...common} />
        <path d="M3 9h18M8 13h3M8 16h5" {...common} />
      </svg>
    );
  }
  if (slug === "chief-of-staff") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <circle cx="12" cy="12" r="8" {...common} />
        <path d="M12 8l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4L12 8z" {...common} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M8 7h8M8 12h8M8 17h5" {...common} />
      <rect x="4" y="4" width="16" height="16" rx="2" {...common} />
    </svg>
  );
}

const ICON_TINT: Record<string, string> = {
  operations: "bg-sky-50 text-sky-700",
  systems: "bg-emerald-50 text-emerald-700",
  automation: "bg-amber-50 text-amber-700",
  revops: "bg-violet-50 text-violet-700",
  "product-ops": "bg-sky-50 text-sky-700",
  "chief-of-staff": "bg-teal-50 text-teal-700",
};

export default async function CategoriesPage() {
  const [tier, jobs] = await Promise.all([
    viewerTier(),
    supabaseAdmin ? loadPublishedBoardJobs(supabaseAdmin) : Promise.resolve([]),
  ]);
  const counts = categoryAvailability(jobs, tier);
  const open = counts.open;
  const early = counts.early;
  const roleLabel = (count: number) => `${count} ${count === 1 ? "role" : "roles"}`;

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-slate-500">Categories</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Explore roles</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.
              {tier === "paid"
                ? " Counts include roles from their first 24 hours."
                : " Counts are the roles you can open now. The first 24 hours are on Premium."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Salary on the listing", "Remote and hybrid", "Reviewed before publish"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  <span className="text-indigo-600" aria-hidden>✓</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/jobs"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white hover:bg-black"
          >
            Browse jobs
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORY_HUBS.map((hub) => {
            const href = `/jobs?category=${encodeURIComponent(hub.slug)}`;
            const earlyCount = early[hub.slug] || 0;
            return (
              <Link
                key={hub.slug}
                href={href}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ICON_TINT[hub.slug] || "bg-slate-50 text-slate-700"}`}>
                    <CategoryIcon slug={hub.slug} />
                  </div>
                  <span className="text-slate-300 transition-colors group-hover:text-indigo-500" aria-hidden>→</span>
                </div>
                <div className="mt-3 text-base font-semibold text-slate-900">{hub.label}</div>
                <div className="mt-1 text-sm font-medium text-indigo-700">{roleLabel(open[hub.slug] || 0)}</div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{hub.intro}</p>
                {earlyCount > 0 ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">{earlyCount} in the first 24 hours</p>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Email for one of these categories</div>
            <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">
              A free account sends that search on Tuesday and Friday, after the role is public. Premium sends it after each search, including the first 24 hours.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/alerts"
              className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Email alerts
            </Link>
            <Link
              href="/salary-insights"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:border-indigo-200"
            >
              Pay on the board
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

