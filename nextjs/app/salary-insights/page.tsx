import SalaryInsights from "../../components/SalaryInsights";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { salaryBucketsFromJobs } from "../../lib/salaryBoardSummary";
import { isOnNicheJob } from "../../lib/nicheScope";
import { applyLiveBoardFilter } from "../../lib/liveBoard";

export const dynamic = "force-dynamic";

export default async function SalaryInsightsPage() {
  let buckets: ReturnType<typeof salaryBucketsFromJobs> = [];
  if (supabaseAdmin) {
    const { data } = await applyLiveBoardFilter(
      supabaseAdmin.from("jobs").select("title,description,salary,category,timestamp").eq("status", "published"),
    )
      .order("timestamp", { ascending: false })
      .range(0, 499);
    const jobs = (data || []).filter((job) => isOnNicheJob({ title: job.title, category: job.category, description: job.description }));
    buckets = salaryBucketsFromJobs(jobs);
  }
  return (
    <div className="pt-6">
      <SalaryInsights buckets={buckets} />
    </div>
  );
}
