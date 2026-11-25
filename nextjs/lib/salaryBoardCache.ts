import { unstable_cache } from "next/cache";
import { BOARD_INDEX_REVALIDATE_SECONDS } from "./boardListQuery";
import { applyLiveBoardFilter, isLiveBoardJob } from "./liveBoard";
import { isOnNicheJob } from "./nicheScope";
import { salaryBucketsFromJobs } from "./salaryBoardSummary";
import { supabaseAdmin } from "./supabaseAdmin";

const PAGE = 200;
const MAX_ROWS = 20000;

export type SalaryBoardJob = {
  title: string | null;
  description: string;
  salary: string;
  category: string;
  location: string;
  remotePolicy: string;
};

/** Full live board for pay buckets. Cached, and not limited to the first page of roles. */
export async function loadSalaryBoardJobs(): Promise<SalaryBoardJob[]> {
  if (!supabaseAdmin) return [];
  const jobs: SalaryBoardJob[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await applyLiveBoardFilter(
      supabaseAdmin
        .from("jobs")
        .select("title,description,salary,category,timestamp,published_at,created_at,location,remote_policy")
        .eq("status", "published")
        .order("timestamp", { ascending: false }),
    ).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const row of rows) {
      if (!isLiveBoardJob(row)) continue;
      if (!isOnNicheJob({ title: row.title, category: row.category, description: row.description })) continue;
      jobs.push({
        title: row.title,
        description: row.description || "",
        salary: row.salary || "",
        category: row.category || "",
        location: row.location || "",
        remotePolicy: row.remote_policy || "",
      });
    }
    if (rows.length < PAGE) break;
  }
  return jobs;
}

const readSalaryBoard = unstable_cache(async () => loadSalaryBoardJobs(), ["salary-board-v1"], {
  revalidate: BOARD_INDEX_REVALIDATE_SECONDS,
});

export async function salaryBucketsForBoard() {
  const jobs = await readSalaryBoard();
  return salaryBucketsFromJobs(jobs);
}
