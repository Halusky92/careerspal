import type { MetadataRoute } from "next";
import { createCompanySlug, createJobSlug } from "../lib/jobs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

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
    const { data: jobs } = await supabaseAdmin
      .from("jobs")
      .select("id,title")
      .eq("status", "published");
    jobRoutes = (jobs || []).map((job) =>
      `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`,
    );

    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("name,slug");
    companyRoutes = (companies || []).map((company) => {
      const name = company.name || "company";
      const slug = company.slug || createCompanySlug({ name });
      return `/companies/${slug}`;
    });
  }

  return [...staticRoutes, ...jobRoutes, ...companyRoutes].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));
}
