import type { Metadata } from "next";
import Link from "next/link";
import CompanyLogo from "../../components/CompanyLogo";
import { createCompanySlug } from "../../lib/jobs";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { isOnNicheJob } from "../../lib/nicheScope";
import { applyLiveBoardFilter, isLiveBoardJob } from "../../lib/liveBoard";

type CompanyCard = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
  location?: string | null;
  verified?: boolean | null;
  liveRoles: number;
};

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

const plainText = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isBoilerplateDescription = (value?: string | null) => {
  const t = (value || "").toLowerCase();
  return t.includes("greenhouse is more than a hiring platform") || t.includes("complete hiring ecosystem");
};

const publicHost = (value?: string | null) => {
  const host = safeHost(value);
  if (!host) return "";
  if (host.includes("greenhouse.io") || host.includes("lever.co") || host.includes("ashbyhq.com")) return "";
  return host;
};

const safeHost = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw || raw === "#") return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
};

async function fetchCompaniesWithLiveRoles(): Promise<CompanyCard[]> {
  if (!supabaseAdmin) return [];

  const { data } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select("company_id,title,category,description,timestamp,companies(id,name,slug,logo_url,website,description,location,verified)")
      .eq("status", "published")
      .not("company_id", "is", null)
      .order("timestamp", { ascending: false })
      .range(0, 499),
  );

  const map = new Map<string, CompanyCard>();

  (data as any[] | null || []).forEach((row) => {
    if (!isOnNicheJob({ title: row?.title, category: row?.category, description: row?.description })) return;
    if (!isLiveBoardJob({ timestamp: row?.timestamp })) return;
    const c = row?.companies;
    const id = (c?.id || row?.company_id || "").toString();
    const name = (c?.name || "").toString().trim();
    if (!id || !name) return;

    const slug = ((c?.slug || "").toString().trim() || createCompanySlug({ name })).trim();
    if (!slug) return;

    const prev = map.get(id);
    if (prev) {
      prev.liveRoles += 1;
      return;
    }

    map.set(id, {
      id,
      name,
      slug,
      logoUrl: c?.logo_url || null,
      website: c?.website || null,
      description: c?.description || null,
      location: c?.location || null,
      verified: c?.verified ?? null,
      liveRoles: 1,
    });
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
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await fetchCompaniesWithLiveRoles();

  return (
    <div className="bg-[#F8F9FD] pb-4">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Companies</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
              Companies with live roles
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Companies with a role live on the board (last 30 days).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/jobs"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-black"
            >
              Browse jobs
            </Link>
            <Link
              href="/hire-talent"
              className="hidden sm:inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            >
              Post a job
            </Link>
          </div>
        </div>

        {companies.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-slate-800 font-medium">No companies to show yet.</p>
            <p className="mt-1 text-sm text-slate-600">Check the job board for the latest roles.</p>
            <div className="mt-4">
              <Link
                href="/jobs"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Browse jobs
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map((c) => {
              const href = `/companies/${c.slug || createCompanySlug({ name: c.name })}`;
              const desc = isBoilerplateDescription(c.description) ? "" : plainText(c.description || "");
              const shortDesc = desc.length > 90 ? `${desc.slice(0, 90).trim()}…` : desc;
              const host = publicHost(c.website);
              return (
                <Link
                  key={c.id}
                  href={href}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-slate-200 p-0.5 flex-shrink-0">
                      <CompanyLogo
                        name={c.name}
                        logoUrl={c.logoUrl}
                        website={c.website}
                        className="w-full h-full rounded-md overflow-hidden bg-white"
                        imageClassName="w-full h-full object-contain"
                        fallbackClassName="text-[10px]"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                        {Boolean(c.verified) && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {c.liveRoles} live role{c.liveRoles === 1 ? "" : "s"}
                        {host ? ` · ${host}` : ""}
                      </div>
                      {shortDesc && !shortDesc.toLowerCase().includes("coming soon") && (
                        <div className="mt-1.5 text-[13px] text-slate-600 leading-snug line-clamp-2">
                          {shortDesc}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {companies.length > 0 && companies.length < 6 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-600">
              More companies show up here as live roles are published.
            </p>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/alerts"
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
              >
                Email alerts
              </Link>
              <Link
                href="/jobs"
                className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Browse jobs
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

