import type { Metadata } from "next";
import SalaryInsights from "../../components/SalaryInsights";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { salaryBucketsFromJobs } from "../../lib/salaryBoardSummary";
import { isOnNicheJob } from "../../lib/nicheScope";
import { applyLiveBoardFilter } from "../../lib/liveBoard";
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
  let buckets: ReturnType<typeof salaryBucketsFromJobs> = [];
  if (supabaseAdmin) {
    const { data } = await applyLiveBoardFilter(
      supabaseAdmin.from("jobs").select("title,description,salary,category,timestamp,location,remote_policy").eq("status", "published"),
    )
      .order("timestamp", { ascending: false })
      .range(0, 499);
    const jobs = (data || [])
      .filter((job) => isOnNicheJob({ title: job.title, category: job.category, description: job.description }))
      .map((job) => ({
        title: job.title,
        description: job.description,
        salary: job.salary,
        category: job.category,
        location: job.location || "",
        remotePolicy: job.remote_policy || "",
      }));
    buckets = salaryBucketsFromJobs(jobs);
  }
  return (
    <div className="pt-6">
      <SalaryInsights buckets={buckets} />
    </div>
  );
}
