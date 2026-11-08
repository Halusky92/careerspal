import type { MetadataRoute } from "next";
import { createCompanySlug, createJobSlug } from "../lib/jobs";
import { CATEGORY_SLUGS } from "../lib/categories";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { applyLiveBoardFilter, isLiveBoardJob } from "../lib/liveBoard";
import { isOnNicheJob } from "../lib/nicheScope";

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const staticRoutes = [
    "",
    "/jobs",
    "/companies",
    "/categories",
    "/alerts",
    "/post-a-job",
    "/pricing",
    "/about",
    "/hire-talent",
    "/salary-insights",
    "/privacy",
    "/terms",
    "/accessibility",
  ];

  let jobRoutes: string[] = [];
  let companyRoutes: string[] = [];
  if (supabaseAdmin) {
    const { data: jobs } = await applyLiveBoardFilter(
      supabaseAdmin
        .from("jobs")
        .select("id,title,category,description,timestamp,companies(name,slug)")
        .eq("status", "published"),
    );

    const live = (jobs || []).filter(
      (job) => isLiveBoardJob({ timestamp: job.timestamp }) && isOnNicheJob(job),
    );

    jobRoutes = live.map((job) => `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`);

    const companies = new Map<string, string>();
    for (const job of live) {
      const rel = job.companies as { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;
      const row = Array.isArray(rel) ? rel[0] : rel;
      const name = (row?.name || "").trim();
      if (!name) continue;
      const slug = ((row?.slug || "").trim() || createCompanySlug({ name })).trim();
      if (slug) companies.set(slug, name);
    }
    companyRoutes = [...companies.keys()].map((slug) => `/companies/${slug}`);
  }

  const categoryRoutes = CATEGORY_SLUGS.map((slug) => `/categories/${slug}`);

  return [...staticRoutes, ...categoryRoutes, ...jobRoutes, ...companyRoutes].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));
}
