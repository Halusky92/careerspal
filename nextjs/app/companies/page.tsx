import type { Metadata } from "next";
import Link from "next/link";
import { companiesFromBoard, getBoardCatalog } from "../../lib/publicBoardCatalog";
import CompaniesClient from "./CompaniesClient";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";

const getBaseUrl = () => getCanonicalSiteUrl();

async function fetchCompaniesWithLiveRoles() {
  try {
    return companiesFromBoard(await getBoardCatalog());
  } catch {
    return [];
  }
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
