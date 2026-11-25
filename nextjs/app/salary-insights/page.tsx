import type { Metadata } from "next";
import SalaryInsights from "../../components/SalaryInsights";
import { salaryBucketsForBoard } from "../../lib/salaryBoardCache";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const canonicalUrl = `${getCanonicalSiteUrl()}/salary-insights`;
  const title = "Pay on the board — CareersPal";
  const description =
    "Observed listing midpoints for Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles on CareersPal. USD roles only. Not a market-wide salary survey.";
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SalaryInsightsPage() {
  let buckets: Awaited<ReturnType<typeof salaryBucketsForBoard>> = [];
  try {
    buckets = await salaryBucketsForBoard();
  } catch {
    buckets = [];
  }
  return (
    <div className="pt-6">
      <SalaryInsights buckets={buckets} />
    </div>
  );
}
