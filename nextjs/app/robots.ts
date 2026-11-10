import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "../lib/alerts/siteUrl";
import { isNonProductionDeployment } from "../lib/siteIndexing";

export default function robots(): MetadataRoute.Robots {
  if (isNonProductionDeployment()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }
  const baseUrl = getCanonicalSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/checkout", "/apply", "/account", "/auth", "/upgrade", "/supabase-test"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
