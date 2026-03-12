import type { Metadata } from "next";
import Link from "next/link";
import CompanyLogo from "../../components/CompanyLogo";
import { createCompanySlug } from "../../lib/jobs";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

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

  const { data } = await supabaseAdmin
    .from("jobs")
    .select("company_id,companies(id,name,slug,logo_url,website,description,location,verified)")
    .eq("status", "published")
    .not("company_id", "is", null)
    .order("timestamp", { ascending: false })
    .range(0, 499);

  const map = new Map<string, CompanyCard>();

  (data as any[] | null || []).forEach((row) => {
    const c = row?.companies;
    const id = (c?.id || row?.company_id || "").toString();
    const name = (c?.name || "").toString().trim();
    if (!id || !name) return;

    const slug = (c?.slug || "").toString().trim();
    if (!slug) return; // keep index canonical + avoid linking to missing pages

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
  const description = "Browse companies with live remote Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles.";

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
    <div className="bg-[#F8F9FD] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Companies</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Companies with live roles
            </h1>
            <p className="mt-3 text-slate-600 font-medium max-w-2xl">
              Only companies with published roles currently live on CareersPal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black"
            >
              Browse jobs
            </Link>
            <Link
              href="/post-a-job"
              className="hidden sm:inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            >
              Post a job
            </Link>
          </div>
        </div>

        {companies.length === 0 ? (
          <div className="mt-10 rounded-[2.75rem] border border-dashed border-slate-200 bg-white/70 backdrop-blur p-10 text-center">
            <p className="text-slate-700 font-black text-lg">No companies to show yet.</p>
            <p className="mt-2 text-slate-600 font-medium">Check the job board for the latest roles.</p>
            <div className="mt-6">
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-7 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700"
              >
                Browse jobs →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((c) => {
              const href = `/companies/${c.slug || createCompanySlug({ name: c.name })}`;
              const desc = plainText(c.description || "");
              const shortDesc = desc.length > 120 ? `${desc.slice(0, 120).trim()}…` : desc;
              return (
                <Link
                  key={c.id}
                  href={href}
                  className="rounded-[2.25rem] border border-slate-200/60 bg-white p-6 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white border border-slate-200/70 p-1 flex-shrink-0">
                      <CompanyLogo
                        name={c.name}
                        logoUrl={c.logoUrl}
                        website={c.website}
                        className="w-full h-full rounded-xl overflow-hidden bg-white"
                        imageClassName="w-full h-full object-contain"
                        fallbackClassName="text-[10px]"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-black text-slate-900 truncate">{c.name}</div>
                        {Boolean(c.verified) && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {c.liveRoles} live role{c.liveRoles === 1 ? "" : "s"}
                        {c.location ? ` • ${c.location}` : ""}
                        {c.website ? ` • ${safeHost(c.website)}` : ""}
                      </div>
                      {shortDesc && !shortDesc.toLowerCase().includes("coming soon") && (
                        <div className="mt-3 text-sm text-slate-600 font-medium leading-relaxed line-clamp-3">
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
      </div>
    </div>
  );
}

