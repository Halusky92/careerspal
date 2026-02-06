import type { MetadataRoute } from "next";
import { createCompanySlug, createJobSlug, getAllCompanies, getAllJobs } from "../lib/jobs";

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  const staticRoutes = [
    "",
    "/jobs",
    "/post-a-job",
    "/pricing",
    "/about",
    "/hire-talent",
    "/salary-insights",
    "/privacy",
    "/terms",
    "/accessibility",
  ];

  const jobRoutes = getAllJobs().map((job) => `/jobs/${createJobSlug(job)}`);
  const companyRoutes = getAllCompanies().map((company) => `/companies/${createCompanySlug(company)}`);

  return [...staticRoutes, ...jobRoutes, ...companyRoutes].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));
}
