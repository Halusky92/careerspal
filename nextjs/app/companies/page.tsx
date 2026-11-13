import type { Metadata } from "next";
import Link from "next/link";
import { createCompanySlug } from "../../lib/jobs";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isOnNicheJob } from "../../lib/nicheScope";
import { applyLiveBoardFilter, isLiveBoardJob } from "../../lib/liveBoard";
import { addJobToCompany, type BoardCompany } from "../../lib/companyBoard";
import CompaniesClient from "./CompaniesClient";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";

const getBaseUrl = () => getCanonicalSiteUrl();

async function fetchCompaniesWithLiveRoles(): Promise<BoardCompany[]> {
  if (!supabaseAdmin) return [];

  const { data } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "company_id,title,category,description,timestamp,published_at,created_at,location,remote_policy,companies(id,name,slug,logo_url,website,description,location,verified)",
      )
      .eq("status", "published")
      .not("company_id", "is", null)
      .order("timestamp", { ascending: false })
      .range(0, 499),
  );

  const map = new Map<string, BoardCompany>();

  (data as any[] | null || []).forEach((row) => {
    if (!isOnNicheJob({ title: row?.title, category: row?.category, description: row?.description })) return;
    if (!isLiveBoardJob(row)) return;
    const c = row?.companies;
    const id = (c?.id || row?.company_id || "").toString();
    const name = (c?.name || "").toString().trim();
    if (!id || !name) return;
    const slug = ((c?.slug || "").toString().trim() || createCompanySlug({ name })).trim();
    if (!slug) return;
    const next = addJobToCompany(map.get(id), {
      id,
      name,
      slug,
      logoUrl: c?.logo_url || null,
      website: c?.website || null,
      description: c?.description || null,
      location: c?.location || null,
      verified: c?.verified ?? null,
      jobTitle: row?.title,
      jobCategory: row?.category,
      jobLocation: row?.location,
      jobRemotePolicy: row?.remote_policy,
    });
    map.set(id, next);
  });

  return [...map.values()].sort((a, b) => b.liveRoles - a.liveRoles || a.name.localeCompare(b.name));
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/companies`;
  const title = "Companies hiring — CareersPal";
  const description = "Browse companies with live Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles.";

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await fetchCompaniesWithLiveRoles();

  if (companies.length === 0) {
    return (
      <div className="bg-[#F8F9FD] pb-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Companies with live roles</h1>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-slate-800 font-medium">No companies to show yet.</p>
            <p className="mt-1 text-sm text-slate-600">Check the job board for the latest roles.</p>
            <Link href="/jobs" className="mt-4 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white">
              Browse jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CompaniesClient companies={companies} />;
}
