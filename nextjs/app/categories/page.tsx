import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_HUBS } from "../../lib/categories";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/categories`;
  const title = "Categories — CareersPal";
  const description =
    "Browse curated remote roles by category: Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.";

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

  const pairs = await Promise.all(
    CATEGORY_HUBS.map(async (hub) => {
      const { count } = await sb
        .from("jobs")
        // head:true avoids downloading rows; count:"exact" gives a real count.
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .in("category", hub.dbCategories);
      return [hub.slug, typeof count === "number" ? count : 0] as const;
    }),
  );

  return Object.fromEntries(pairs);
}

export default async function CategoriesPage() {
  const counts = await fetchLiveCounts();

  return (
    <div className="bg-[#F8F9FD] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Categories</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Browse by category
            </h1>
            <p className="mt-3 text-slate-600 font-medium max-w-2xl">
              Tight categories for Ops & Systems work. Each category lists published roles currently live on CareersPal.
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
                className="rounded-[2.25rem] border border-slate-200/60 bg-white p-6 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-black text-slate-900 truncate">{hub.label}</div>
                    <div className="mt-2 text-sm text-slate-600 font-medium leading-relaxed">
                      {hub.intro}
                    </div>
                    {hub.temporaryMappingNote && (
                      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Broad category mapping (temporary)
                      </div>
                    )}
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

