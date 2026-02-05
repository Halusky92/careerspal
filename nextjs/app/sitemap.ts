import type { MetadataRoute } from "next";
import { createCompanySlug, createJobSlug, getAllCompanies, getAllJobs } from "../lib/jobs";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://careerspal.com";

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
