import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import CompanyLogo from "../../../components/CompanyLogo";
import FormattedDescriptionStatic from "../../../components/FormattedDescriptionStatic";
import { extractJobDetailSections } from "../../../lib/sourcing/normalization/description";
import { publicCategoryLabel, resolveCategoryHub } from "../../../lib/categories";
import { createCompanySlug, createJobSlug, getJobIdFromSlug } from "../../../lib/jobs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../lib/supabaseJobs";
import type { Job } from "../../../types";
import { isOnNicheJob } from "../../../lib/nicheScope";
import { formatJobSalary } from "../../../lib/formatSalary";
import { inferWorkMode, publicLocationLabel } from "../../../lib/workMode";
import { applyLiveBoardFilter, isLiveBoardJob } from "../../../lib/liveBoard";
import { getCanonicalSiteUrl } from "../../../lib/alerts/siteUrl";
import { buildJobPostingLd } from "../../../lib/jobPostingLd";
import { ApplyClickLink, JobViewTracker } from "../../../components/JobAnalytics";
import FeaturedBadge from "../../../components/FeaturedBadge";
import { isPaidFeaturedListing } from "../../../lib/featuredListing";
import PublicSubscriberNote from "../../../components/PublicSubscriberNote";
import { getPublicSubscriberCount } from "../../../lib/countAlertSubscribers";
import {
  interpretApiFallback,
  interpretDirectLookup,
  JobLookupUnavailableError,
} from "../../../lib/jobs/publicJobLookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getBaseUrl = () => getCanonicalSiteUrl();

async function fetchPublicJobViaApi(jobId: string): Promise<{ status: number | null; job: Job | null }> {
  try {
    let baseUrl = getBaseUrl();
    try {
      const h = await headers();
      const host = (h.get("x-forwarded-host") || h.get("host") || "").trim();
      const proto = (h.get("x-forwarded-proto") || "https").trim();
      if (host) baseUrl = `${proto}://${host}`;
    } catch {
      // ignore
    }
    // Canonicalize apex -> www for internal fetches (avoids redirect edge-cases).
    if (baseUrl.startsWith("https://careerspal.com")) baseUrl = baseUrl.replace("https://careerspal.com", "https://www.careerspal.com");
    if (baseUrl.startsWith("http://careerspal.com")) baseUrl = baseUrl.replace("http://careerspal.com", "https://www.careerspal.com");
    const res = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      redirect: "follow",
    });
    if (!res.ok) return { status: res.status, job: null };
    const json = (await res.json()) as { job?: Job };
    return { status: res.status, job: json.job || null };
  } catch {
    return { status: null, job: null };
  }
}

const isExternalUrl = (value?: string | null) => {
  const url = (value || "").trim();
  if (!url || url === "#" || url.startsWith("/") || url.startsWith("mailto:")) return false;
  return true;
};

const plainText = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeDescription = (value?: string | null) => {
  if (!value) return "";
  const lines = value.split("\n");
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed) return true;
    if (trimmed.startsWith("import-") || trimmed.startsWith("import/")) return false;
    if (trimmed.includes("import-") && !trimmed.includes(" ")) return false;
    return true;
  });
  return cleaned.join("\n").trim();
};

const makeDescription = (job: Job) => {
  const bits: string[] = [];
  if (job.salary) bits.push(`Salary: ${formatJobSalary(job)}.`);
  if (job.location) bits.push(`Location: ${job.location}.`);
  const mode = inferWorkMode(job);
  if (mode) bits.push(`Work mode: ${mode}.`);
  const category = publicCategoryLabel(job);
  if (category) bits.push(`Category: ${category}.`);
  const base = bits.join(" ");
  const desc = plainText(sanitizeDescription(job.description) || "");
  const clipped = desc.length > 240 ? `${desc.slice(0, 240).trim()}…` : desc;
  return [base, clipped].filter(Boolean).join(" ").trim();
};

async function fetchPublishedJobBySlug(slug: string): Promise<
  { outcome: "found"; job: Job } | { outcome: "missing" } | { outcome: "unavailable" }
> {
  const jobId = getJobIdFromSlug(slug);
  let row: Job | null = null;
  let error: { code?: string | null } | null = null;

  if (jobId && supabaseAdmin) {
    try {
      const result = await supabaseAdmin
        .from("jobs")
        .select(
          "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,published_at,created_at,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,slug,logo_url,website,description,verified)",
        )
        .eq("id", jobId)
        .single();
      error = result.error ? { code: result.error.code } : null;
      if (result.data && !result.error) row = mapSupabaseJob(result.data as SupabaseJobRow);
    } catch {
      error = { code: "FETCH_FAILED" };
    }
  }

  const direct = interpretDirectLookup({
    jobId,
    configured: Boolean(jobId && supabaseAdmin),
    row,
    error,
    isPublic: Boolean(row && row.status === "published" && isOnNicheJob(row)),
  });
  if (direct.outcome === "found") return direct;
  if (direct.outcome === "missing") return { outcome: "missing" };
  if (!jobId) return { outcome: "missing" };

  const api = await fetchPublicJobViaApi(jobId);
  const fallback = interpretApiFallback({
    reason: direct.reason,
    status: api.status,
    job: api.job,
    isPublic: Boolean(api.job && api.job.status === "published" && isOnNicheJob(api.job)),
  });
  if (fallback.outcome === "found") return fallback;
  if (fallback.outcome === "missing") return { outcome: "missing" };
  return { outcome: "unavailable" };
}

const loadPublicJob = cache(fetchPublishedJobBySlug);

async function debugResolveJob(slug: string) {
  const jobId = getJobIdFromSlug(slug);
  const out: Record<string, unknown> = {
    slug,
    jobId,
    hasSupabaseAdmin: Boolean(supabaseAdmin),
  };

  try {
    const h = await headers();
    out.request = {
      host: h.get("host"),
      xfHost: h.get("x-forwarded-host"),
      xfProto: h.get("x-forwarded-proto"),
      xfFor: h.get("x-forwarded-for"),
    };
  } catch {
    // ignore
  }

  if (jobId && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("id,status,created_at,published_at")
      .eq("id", jobId)
      .maybeSingle();
    out.supabase = {
      hasData: Boolean(data),
      error: error ? { message: error.message, code: (error as unknown as { code?: string }).code } : null,
      data,
    };
  }

  if (jobId) {
    const siteUrl =
      (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")) || null;
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
    out.env = { siteUrl, vercelUrl };

    try {
      const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const txt = await r.text();
      out.apiRelative = {
        status: r.status,
        cacheControl: r.headers.get("cache-control"),
        location: r.headers.get("location"),
        bodyStart: txt.slice(0, 240),
      };
    } catch (e) {
      out.apiRelative = { error: String((e as Error)?.message || e) };
    }
  }

  return out;
}

async function fetchSimilarPublishedJobs(job: Job): Promise<Job[]> {
  if (!supabaseAdmin) return [];
  const hub = resolveCategoryHub(job);
  if (!hub) return [];

  const { data } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description,verified)",
      )
      .eq("status", "published")
      .neq("id", job.id)
      .order("timestamp", { ascending: false })
      .range(0, 39),
  );

  return (data as SupabaseJobRow[] | null || [])
    .map(mapSupabaseJob)
    .filter((item) => isOnNicheJob(item) && resolveCategoryHub(item)?.slug === hub.slug)
    .slice(0, 3);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPublicJob(slug);
  if (loaded.outcome !== "found") {
    return { robots: { index: false, follow: false } };
  }
  const job = loaded.job;

  const baseUrl = getBaseUrl();
  const canonicalPath = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  const title = `${job.title} at ${job.company} — ${formatJobSalary(job)} | CareersPal`;
  const description = makeDescription(job) || `${job.title} at ${job.company}.`;

  const imageUrl = job.logo ? (job.logo.startsWith("http") ? job.logo : `${baseUrl}${job.logo}`) : undefined;

  const live = isLiveBoardJob(job);
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: live ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const loaded = await loadPublicJob(slug);
  if (loaded.outcome === "unavailable") throw new JobLookupUnavailableError();
  const job = loaded.outcome === "found" ? loaded.job : null;
  let debug = "";
  let ua = "";
  try {
    const h = await headers();
    debug = (h.get("x-cp-debug") || "").trim();
    ua = (h.get("user-agent") || "").toLowerCase();
  } catch {
    // ignore
  }
  if (!debug) {
    const query = (await searchParams) || {};
    debug =
      typeof query.debug === "string"
        ? query.debug
        : Array.isArray(query.debug)
          ? query.debug[0]
          : "";
  }
  // Last resort for diagnostics: allow debug rendering for our scripted probes.
  if (!debug && ua.includes("cp-debug")) debug = "1";

  if (!job) {
    if (debug === "1") {
      const info = await debugResolveJob(slug);
      return (
        <div className="bg-[#F8F9FD] min-h-screen">
          <div className="max-w-4xl mx-auto px-6 pt-16 pb-24">
            <div className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-10">
              <h1 className="text-2xl font-black text-slate-900">Job resolve debug</h1>
              <p className="mt-2 text-sm text-slate-600 font-medium">
                This view is only shown with <span className="font-mono">?debug=1</span>.
              </p>
              <pre className="mt-6 text-xs leading-relaxed bg-slate-50 border border-slate-200/70 rounded-2xl p-5 overflow-auto">
                {JSON.stringify(info, null, 2)}
              </pre>
              <div className="mt-6">
                <Link
                  href="/jobs"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
                >
                  Back to jobs
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }
    notFound();
  }

  const similarJobs = await fetchSimilarPublishedJobs(job);
  const subscriberCount = await getPublicSubscriberCount();
  const canonicalSlug = createJobSlug({ id: job.id, title: job.title || "role" });
  const canonicalPath = `/jobs/${canonicalSlug}`;
  const canonicalUrl = `${getBaseUrl()}${canonicalPath}`;

  const jobPostingLd = buildJobPostingLd(
    { ...job, description: sanitizeDescription(job.description) || job.description },
    canonicalUrl,
  );

  const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl.trim() !== "#");
  const applyExternal = isExternalUrl(job.applyUrl);
  const companySlug = (job.companySlug || "").toString().trim();
  const companyHref = `/companies/${(companySlug && companySlug !== "undefined" && companySlug !== "null"
    ? companySlug
    : createCompanySlug({ name: job.company || "Company" })).trim()}`;

  const stack = (job.tools && job.tools.length > 0 ? job.tools : job.tags || []).filter(Boolean).slice(0, 12);
  const benefits = (job.benefits || []).filter(Boolean).slice(0, 12);
  const workMode = inferWorkMode(job);
  const locationLabel = publicLocationLabel(job);
  const categoryLabel = publicCategoryLabel(job);
  const displayType = job.type && job.type !== "Unknown" ? job.type : null;
  const roleSections = extractJobDetailSections(sanitizeDescription(job.description) || "");
  const alertHub = resolveCategoryHub(job);
  const alertsHref = alertHub ? `/alerts?category=${encodeURIComponent(alertHub.slug)}` : "/alerts";

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <JobViewTracker jobId={job.id} />
      {jobPostingLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd) }} />
      ) : null}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700"
          >
            <span aria-hidden="true">←</span> Back to jobs
          </Link>
          <Link
            href={`/jobs?jobId=${encodeURIComponent(job.id)}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
          >
            View on board →
          </Link>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-white border border-slate-200/70 p-1 flex-shrink-0">
                <CompanyLogo
                  name={job.company}
                  logoUrl={job.logo}
                  website={job.companyWebsite || job.applyUrl}
                  className="w-full h-full rounded-xl overflow-hidden bg-white"
                  imageClassName="w-full h-full object-contain"
                  fallbackClassName="text-[10px]"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {categoryLabel && (
                    <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {categoryLabel}
                    </span>
                  )}
                  {displayType && (
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {displayType}
                    </span>
                  )}
                  {workMode ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      {workMode}
                    </span>
                  ) : null}
                  {locationLabel && (
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {locationLabel}
                    </span>
                  )}
                  {job.postedAt && (
                    <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Posted {job.postedAt}
                    </span>
                  )}
                </div>

                <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {job.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Link
                    href={companyHref}
                    className="text-sm sm:text-base font-black text-indigo-700 hover:text-indigo-800 hover:underline decoration-indigo-300 underline-offset-2"
                  >
                    {job.company}
                  </Link>
                  <span className="text-slate-300">•</span>
                  <span className="text-sm sm:text-base font-black text-slate-900">{formatJobSalary(job)}</span>
                  {isPaidFeaturedListing(job) ? <FeaturedBadge job={job} size="md" /> : null}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  {hasApplyUrl ? (
                    <ApplyClickLink
                      jobId={job.id}
                      href={job.applyUrl}
                      external={applyExternal}
                      className="hidden lg:inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 text-white px-6 py-3.5 text-sm font-medium hover:bg-indigo-700"
                    >
                      Apply now
                    </ApplyClickLink>
                  ) : (
                    <span className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-200 text-slate-500 px-6 py-3.5 text-sm font-medium">
                      Apply link not listed
                    </span>
                  )}
                  <a
                    href={canonicalUrl}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-800 hover:border-indigo-200"
                  >
                    Copy / share link
                  </a>
                  <Link
                    href={alertsHref}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-800 hover:border-indigo-200"
                  >
                    Email similar roles
                  </Link>
                </div>

                <p className="mt-4 text-xs text-slate-500 font-medium">
                  Always verify role details on the official application page.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {roleSections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">{section.heading}</h2>
                <div className="mt-3">
                  <FormattedDescriptionStatic text={section.body} />
                </div>
              </section>
            ))}

            {stack.length > 0 && (
              <section>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Tool stack</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stack.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {benefits.length > 0 && (
              <section>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Benefits</h2>
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-medium">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-black mt-0.5">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {similarJobs.length > 0 && (
              <section>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">More in {categoryLabel || "this category"}</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {similarJobs.map((s) => (
                    <Link
                      key={s.id}
                      href={`/jobs/${createJobSlug({ id: s.id, title: s.title || "role" })}`}
                      className="rounded-2xl border border-slate-200/60 bg-white px-4 py-4 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                    >
                      <div className="text-sm font-black text-slate-900 line-clamp-2">{s.title}</div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 line-clamp-1">
                        {s.company}
                      </div>
                      <div className="mt-2 text-sm font-black text-slate-900">{formatJobSalary(s)}</div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Alerts</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Stay in the loop
              </h2>
              <p className="mt-2 text-slate-600 font-medium max-w-2xl">
                Fresh openings in your inbox as they hit the market.
              </p>
              <PublicSubscriberNote count={subscriberCount} className="mt-2 text-sm text-slate-600 font-medium" />
            </div>
            <div className="w-full sm:w-auto">
              <Link
                href={alertsHref}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-7 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100"
              >
                Get alerts →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky apply bar (WWR-inspired) */}
      {hasApplyUrl && (
        <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white/90 backdrop-blur border-t border-slate-200/70">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{job.company}</div>
              <div className="text-sm font-black text-slate-900 truncate">{job.title}</div>
            </div>
            <ApplyClickLink
              jobId={job.id}
              href={job.applyUrl}
              external={applyExternal}
              className="h-11 px-5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center justify-center whitespace-nowrap"
            >
              Apply now
            </ApplyClickLink>
          </div>
        </div>
      )}
    </div>
  );
}
