import type { MetadataRoute } from "next";
import { createCompanySlug, createJobSlug } from "../lib/jobs";
import { CATEGORY_SLUGS } from "../lib/categories";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { applyLiveBoardFilter, isLiveBoardJob } from "../lib/liveBoard";
import { isOnNicheJob } from "../lib/nicheScope";
import { getCanonicalSiteUrl } from "../lib/alerts/siteUrl";
import { isNonProductionDeployment } from "../lib/siteIndexing";

function lastmodFromTimestamp(timestamp?: number | null): Date | undefined {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function lastmodFromIso(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function lastmodForJob(job: { timestamp?: number | null; updated_at?: string | null }): Date | undefined {
  const posted = lastmodFromTimestamp(job.timestamp);
  const updated = lastmodFromIso(job.updated_at || null);
  if (posted && updated) return updated.getTime() > posted.getTime() ? updated : posted;
  return updated || posted;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isNonProductionDeployment()) return [];
  const baseUrl = getCanonicalSiteUrl();

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

  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
  }));

  if (supabaseAdmin) {
    const { data: jobs } = await applyLiveBoardFilter(
      supabaseAdmin
        .from("jobs")
        .select("id,title,category,description,timestamp,published_at,created_at,updated_at,companies(name,slug)")
        .eq("status", "published"),
    );

    const live = (jobs || []).filter(
      (job) => isLiveBoardJob(job) && isOnNicheJob(job),
    );

    for (const job of live) {
      const lastModified = lastmodForJob(job);
      entries.push({
        url: `${baseUrl}/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`,
        ...(lastModified ? { lastModified } : {}),
      });
    }

    const companies = new Map<string, number>();
    for (const job of live) {
      const rel = job.companies as { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;
      const row = Array.isArray(rel) ? rel[0] : rel;
      const name = (row?.name || "").trim();
      if (!name) continue;
      const slug = ((row?.slug || "").trim() || createCompanySlug({ name })).trim();
      if (!slug) continue;
      const posted = typeof job.timestamp === "number" ? job.timestamp : 0;
      const updatedMs = job.updated_at ? Date.parse(job.updated_at) : 0;
      const ts = Math.max(posted, Number.isFinite(updatedMs) ? updatedMs : 0);
      companies.set(slug, Math.max(companies.get(slug) || 0, ts));
    }
    for (const [slug, ts] of companies) {
      const lastModified = lastmodFromTimestamp(ts);
      entries.push({
        url: `${baseUrl}/companies/${slug}`,
        ...(lastModified ? { lastModified } : {}),
      });
    }
  }

  for (const slug of CATEGORY_SLUGS) {
    entries.push({ url: `${baseUrl}/categories/${slug}` });
  }

  return entries;
}
