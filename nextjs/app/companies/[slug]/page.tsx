import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import CompanyLogo from "../../../components/CompanyLogo";
import { createCompanySlug, createJobSlug } from "../../../lib/jobs";
import type { Company, Job } from "../../../types";
import { formatSalaryDisplay } from "../../../lib/formatSalary";
import { isOnNicheJob } from "../../../lib/nicheScope";

// Ensure a consistent runtime (avoid edge differences that can cause production-only crashes).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CompanyApiPayload = { company: Company & { verified?: boolean }; jobs: Job[] };
type CompanyFetchResult =
  | { kind: "ok"; company: Company & { verified?: boolean }; jobs: Job[] }
  | { kind: "not_found" }
  | { kind: "error" };

const getBaseUrl = async () => {
  // Prefer per-request host to avoid env mismatch across apex/www or preview domains.
  try {
    const h = await headers();
    let host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
    const xfProto = (h.get("x-forwarded-proto") || "").split(",")[0].trim();
    const proto =
      xfProto ||
      (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    // In local dev, host header can sometimes omit the port. Default to PORT/3000.
    if (host && !host.includes(":") && process.env.NODE_ENV !== "production") {
      const port = process.env.PORT || "3000";
      host = `${host}:${port}`;
    }
    if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  } catch {
    // ignore (e.g. build time)
  }
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

async function fetchCompanyAndJobs(slug: string): Promise<CompanyFetchResult> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}/api/companies/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return { kind: "not_found" };
  if (!res.ok) return { kind: "error" };
  const json = (await res.json()) as CompanyApiPayload;
  if (!json?.company) return { kind: "error" };
  return { kind: "ok", company: json.company, jobs: Array.isArray(json.jobs) ? json.jobs : [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const result = await fetchCompanyAndJobs(slug);
    if (result.kind !== "ok") return {};

    const baseUrl = await getBaseUrl();
    const companyName = result.company.name || "Company";
    const canonicalSlug = slug || createCompanySlug({ name: companyName });
    const canonicalPath = `/companies/${canonicalSlug}`;
    const canonicalUrl = `${baseUrl}${canonicalPath}`;

    const title = `${companyName} — Remote Ops & Systems roles | CareersPal`;
    const desc = plainText(result.company.description || "").slice(0, 240);
    const description = desc || `Explore live remote roles from ${companyName} on CareersPal.`;

    const imageUrl = result.company.logo
      ? result.company.logo.startsWith("http")
        ? result.company.logo
        : `${baseUrl}${result.company.logo}`
      : undefined;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: "website",
        images: imageUrl ? [{ url: imageUrl }] : undefined,
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
    };
  } catch (e) {
    console.error("[companies/[slug]] generateMetadata_failed", { error: (e as any)?.message || String(e) });
    return {};
  }
}

export default async function CompanyPage({ params }: PageProps) {
  const { slug } = await params;
  let result: CompanyFetchResult | null = null;
  try {
    result = await fetchCompanyAndJobs(slug);
  } catch (e) {
    console.error("[companies/[slug]] render_failed", { slug, error: (e as any)?.message || String(e) });
  }
  if (!result || result.kind === "error") {
    // Prefer a clean fallback over crashing into the global error boundary.
    return (
      <div className="bg-[#F8F9FD] pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Company</div>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">This page is temporarily unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              Please try again in a moment. You can still browse roles on the job board.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/jobs"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-black"
              >
                Browse jobs
              </Link>
              <Link
                href={`/companies/${slug}`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:border-indigo-200 hover:text-indigo-700"
              >
                Retry
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (result.kind === "not_found") notFound();

  const { company, jobs: rawJobs } = result;
  const jobs = rawJobs.filter((job) => isOnNicheJob(job));
  const companyName = company.name || "Company";
  const companyWebsite = (company.website || "").trim();
  const companyDescription = ((company.longDescription || company.description) || "").trim();
  const companyLocation = (company.headquarters || "").trim();
  const employeeCount = (company.employeeCount || "").trim();
  const showVerified = Boolean(company.verified);

  const stack = Array.from(
    new Set(
      jobs
        .flatMap((j) => (j.tools && j.tools.length > 0 ? j.tools : j.tags || []))
        .map((v) => (v || "").toString().trim())
        .filter(Boolean),
    ),
  ).slice(0, 18);

  const benefits = Array.from(
    new Set(
      jobs
        .flatMap((j) => (j.benefits || []) as string[])
        .map((v) => (v || "").toString().trim())
        .filter(Boolean),
    ),
  ).slice(0, 18);

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-700">
          <span aria-hidden="true">←</span> Back to jobs
        </Link>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-20 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 p-1">
                  <CompanyLogo
                    name={companyName}
                    logoUrl={company.logo}
                    website={companyWebsite || undefined}
                    className="w-full h-full rounded-md overflow-hidden bg-white"
                    imageClassName="w-full h-full object-contain"
                    fallbackClassName="text-[10px]"
                  />
                </div>

                <h1 className="mt-3 text-lg font-semibold text-slate-900 tracking-tight">{companyName}</h1>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {showVerified && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                      Verified
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">
                    {jobs.length} live role{jobs.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {companyLocation && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">HQ</span>
                      <span className="text-slate-900">{companyLocation}</span>
                    </div>
                  )}
                  {employeeCount && employeeCount !== "—" && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Size</span>
                      <span className="text-slate-900">{employeeCount}</span>
                    </div>
                  )}
                  {companyWebsite && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Website</span>
                      <a
                        href={companyWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-700 hover:underline underline-offset-2"
                      >
                        {safeHost(companyWebsite)}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-1.5">
                  <a
                    href="#roles"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    View roles
                  </a>
                  {companyWebsite ? (
                    <a
                      href={companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                    >
                      Visit website
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="px-4 py-3 flex flex-wrap gap-1.5">
                <a href="#about" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                  About
                </a>
                {stack.length > 0 && (
                  <a href="#stack" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                    Stack
                  </a>
                )}
                {benefits.length > 0 && (
                  <a href="#benefits" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                    Benefits
                  </a>
                )}
                <a href="#roles" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                  Roles
                </a>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8 space-y-3">
            <section id="about" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">About</div>
              <h2 className="mt-1 text-base font-semibold text-slate-900">What they do</h2>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                {companyDescription && !companyDescription.toLowerCase().includes("coming soon")
                  ? companyDescription
                  : "No company description yet. Always verify details on the official company site."}
              </p>
            </section>

            {stack.length > 0 && (
              <section id="stack" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stack</div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">Tools & keywords seen in roles</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stack.map((t) => (
                    <span key={t} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Derived from published role descriptions. Not guaranteed for every team.
                </p>
              </section>
            )}

            {benefits.length > 0 && (
              <section id="benefits" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Benefits</div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">Benefits mentioned in roles</h2>
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-slate-700">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section id="roles" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Roles</div>
              <h2 className="mt-1 text-base font-semibold text-slate-900">All {companyName} roles</h2>
              <p className="mt-1 text-sm text-slate-600">
                {jobs.length > 0 ? "Published roles currently live on CareersPal." : "No published roles live right now."}
              </p>

              {jobs.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {jobs.map((job) => {
                    const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
                    return (
                      <li key={job.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={href} className="block text-sm font-semibold text-slate-900 hover:text-indigo-700 truncate">
                              {job.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-slate-500">
                              {job.location && <span className="truncate">{job.location}</span>}
                              {job.postedAt && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="truncate">{job.postedAt}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-sm font-medium text-slate-900 whitespace-nowrap">
                              {formatSalaryDisplay(job.salary)}
                            </div>
                            <Link href={href} className="mt-1 inline-flex text-xs font-medium text-indigo-700 hover:underline">
                              View role
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-sm text-slate-600">Browse the job board for other live roles.</p>
                  <Link
                    href="/jobs"
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-black"
                  >
                    Browse jobs
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
