import type { MetadataRoute } from "next";
import { createCompanySlug, createJobSlug } from "../lib/jobs";
import { CATEGORY_SLUGS } from "../lib/categories";
import { getCanonicalSiteUrl } from "../lib/alerts/siteUrl";
import { isNonProductionDeployment } from "../lib/siteIndexing";
import { isEarlyAccessListing } from "../lib/listingWindow";
import { getBoardCatalog } from "../lib/publicBoardCatalog";
import { BOARD_INDEX_REVALIDATE_SECONDS } from "../lib/boardListQuery";

export const revalidate = BOARD_INDEX_REVALIDATE_SECONDS;

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

function lastmodForJob(job: { timestamp?: number | null; updated_at?: string | null; updatedAt?: string | null }): Date | undefined {
  const posted = lastmodFromTimestamp(job.timestamp);
  const updated = lastmodFromIso(job.updatedAt || job.updated_at || null);
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
    "/support",
    "/hire-talent",
    "/salary-insights",
    "/privacy",
    "/terms",
    "/accessibility",
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
  }));

  const live = (await getBoardCatalog().catch(() => [])).filter((job) => !isEarlyAccessListing(job));

  for (const job of live) {
    const lastModified = lastmodForJob(job);
    entries.push({
      url: `${baseUrl}/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`,
      ...(lastModified ? { lastModified } : {}),
    });
  }

  const companies = new Map<string, number>();
  for (const job of live) {
    const name = (job.company || "").trim();
    if (!name) continue;
    const slug = ((job.companySlug || "").trim() || createCompanySlug({ name })).trim();
    if (!slug) continue;
    const posted = typeof job.timestamp === "number" ? job.timestamp : 0;
    const updatedMs = job.updatedAt ? Date.parse(job.updatedAt) : 0;
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

  for (const slug of CATEGORY_SLUGS) {
    entries.push({ url: `${baseUrl}/categories/${slug}` });
  }

  return entries;
}
