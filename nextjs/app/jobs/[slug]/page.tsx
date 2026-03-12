import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompanyLogo from "../../../components/CompanyLogo";
import { getCategoryHubForDbCategory } from "../../../lib/categories";
import { createCompanySlug, createJobSlug, getJobIdFromSlug } from "../../../lib/jobs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../lib/supabaseJobs";
import type { Job } from "../../../types";

type PageProps = {
  params: { slug: string };
};

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

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

const splitSummary = (value: string) => {
  const cleaned = sanitizeDescription(value);
  if (!cleaned) return { summary: "", details: "" };
  const parts = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { summary: "", details: "" };
  const summary = parts[0];
  const details = parts.slice(1).join("\n\n").trim();
  return { summary, details };
};

const extractLabeledSection = (value: string, label: string) => {
  const cleaned = sanitizeDescription(value);
  if (!cleaned) return "";
  const lines = cleaned.split("\n");
  const starts = new RegExp(`^\\s*${label}\\s*:?\\s*$`, "i");
  const heading = /^\s*(responsibilities|requirements|what you’ll do|what youll do|qualifications)\s*:?\s*$/i;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (starts.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) return "";
  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i += 1) {
    if (heading.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
};

const makeDescription = (job: Job) => {
  const bits: string[] = [];
  if (job.salary) bits.push(`Salary: ${job.salary}.`);
  if (job.location) bits.push(`Location: ${job.location}.`);
  if (job.remotePolicy) bits.push(`Remote policy: ${job.remotePolicy}.`);
  if (job.category) bits.push(`Category: ${job.category}.`);
  const base = bits.join(" ");
  const desc = plainText(sanitizeDescription(job.description) || "");
  const clipped = desc.length > 240 ? `${desc.slice(0, 240).trim()}…` : desc;
  return [base, clipped].filter(Boolean).join(" ").trim();
};

async function fetchPublishedJobBySlug(slug: string): Promise<Job | null> {
  if (!supabaseAdmin) return null;
  const jobId = getJobIdFromSlug(slug);
  if (!jobId) return null;

  const { data } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description,verified)",
    )
    .eq("id", jobId)
    .eq("status", "published")
    .maybeSingle();

  if (!data) return null;
  return mapSupabaseJob(data as SupabaseJobRow);
}

async function fetchSimilarPublishedJobs(job: Job): Promise<Job[]> {
  if (!supabaseAdmin) return [];
  if (!job.category) return [];

  const { data } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description,verified)",
    )
    .eq("status", "published")
    .eq("category", job.category)
    .neq("id", job.id)
    .order("timestamp", { ascending: false })
    .range(0, 2);

  return (data as SupabaseJobRow[] | null || []).map(mapSupabaseJob);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const job = await fetchPublishedJobBySlug(params.slug);
  if (!job) return {};

  const baseUrl = getBaseUrl();
  const canonicalPath = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  const title = `${job.title} at ${job.company} — ${job.salary || "Salary listed"} | CareersPal`;
  const description = makeDescription(job) || `${job.title} at ${job.company}.`;

  const imageUrl = job.logo ? (job.logo.startsWith("http") ? job.logo : `${baseUrl}${job.logo}`) : undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
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

export default async function JobDetailPage({ params }: PageProps) {
  const job = await fetchPublishedJobBySlug(params.slug);
  if (!job) notFound();

  const similarJobs = await fetchSimilarPublishedJobs(job);
  const canonicalSlug = createJobSlug({ id: job.id, title: job.title || "role" });
  const canonicalPath = `/jobs/${canonicalSlug}`;
  const canonicalUrl = `${getBaseUrl()}${canonicalPath}`;

  const postedDateIso =
    job.timestamp && Number.isFinite(job.timestamp) ? new Date(job.timestamp).toISOString() : undefined;

  const jobPostingLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: plainText(sanitizeDescription(job.description) || ""),
    datePosted: postedDateIso,
    employmentType: job.type,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      sameAs: job.companyWebsite || undefined,
      logo: job.logo || undefined,
    },
    jobLocationType: (job.remotePolicy || "").toLowerCase().includes("remote") ? "TELECOMMUTE" : undefined,
    directApply: isExternalUrl(job.applyUrl) ? true : undefined,
  };

  const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl.trim() !== "#");
  const applyExternal = isExternalUrl(job.applyUrl);

  const stack = (job.tools && job.tools.length > 0 ? job.tools : job.tags || []).filter(Boolean).slice(0, 12);
  const benefits = (job.benefits || []).filter(Boolean).slice(0, 12);
  const { summary, details } = splitSummary(job.description || "");
  const responsibilities = extractLabeledSection(job.description || "", "Responsibilities");
  const requirements = extractLabeledSection(job.description || "", "Requirements");
  const alertHub = getCategoryHubForDbCategory(job.category || "");
  const alertsHref = alertHub ? `/alerts?category=${encodeURIComponent(alertHub.slug)}` : "/alerts";

  return (
    <div className="bg-[#F8F9FD] pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd) }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
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

        <div className="mt-6 rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="p-6 sm:p-10 border-b border-slate-100">
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
                  {job.category && (
                    <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {job.category}
                    </span>
                  )}
                  {job.type && (
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {job.type}
                    </span>
                  )}
                  {job.remotePolicy && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      {job.remotePolicy}
                    </span>
                  )}
                  {job.location && (
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {job.location}
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
                    href={`/companies/${createCompanySlug({ name: job.company })}`}
                    className="text-sm sm:text-base font-black text-indigo-700 hover:text-indigo-800 hover:underline decoration-indigo-300 underline-offset-2"
                  >
                    {job.company}
                  </Link>
                  <span className="text-slate-300">•</span>
                  <span className="text-sm sm:text-base font-black text-slate-900">{job.salary || "Salary listed"}</span>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  {hasApplyUrl ? (
                    <a
                      href={job.applyUrl}
                      target={applyExternal ? "_blank" : undefined}
                      rel={applyExternal ? "noopener noreferrer nofollow" : undefined}
                      className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-7 py-4 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100"
                    >
                      Apply on employer site →
                    </a>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-2xl bg-slate-200 text-slate-500 px-7 py-4 text-[11px] font-black uppercase tracking-widest">
                      Apply link coming soon
                    </span>
                  )}
                  <a
                    href={canonicalUrl}
                    className="inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-7 py-4 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    Share link
                  </a>
                </div>

                <p className="mt-4 text-xs text-slate-500 font-medium">
                  Always verify role details on the official application page.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 space-y-8">
            <section>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Summary</h2>
              <p className="mt-3 text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                {summary || plainText(sanitizeDescription(job.description) || "") || "Description is being updated."}
              </p>
            </section>

            {(responsibilities || requirements || details) && (
              <section>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
                  Responsibilities & requirements
                </h2>
                <div className="mt-3 space-y-4 text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {responsibilities && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Responsibilities
                      </div>
                      <div className="mt-2">{responsibilities}</div>
                    </div>
                  )}
                  {requirements && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Requirements
                      </div>
                      <div className="mt-2">{requirements}</div>
                    </div>
                  )}
                  {!responsibilities && !requirements && details && <div>{details}</div>}
                </div>
              </section>
            )}

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
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">More in {job.category}</h2>
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
                      <div className="mt-2 text-sm font-black text-slate-900">{s.salary || "Salary listed"}</div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="mt-12 rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Alerts</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Get similar roles by email.
              </h2>
              <p className="mt-2 text-slate-600 font-medium max-w-2xl">
                Set up an alert for this category. Alerts are tied to your account email.
              </p>
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
    </div>
  );
}
