import { Job } from "../types";
import { detectAndParseSalaryForGreenhouse, parseSalaryFromText } from "./sourcing/normalization/salary";
import { CATEGORY_FILTER_LABELS } from "../constants";

export type SalaryBucket = {
  category: string;
  label: string;
  count: number;
  min: number;
  max: number;
  median: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

function yearlyAmount(job: Pick<Job, "salary" | "description">): number | null {
  const blob = `${job.salary || ""}\n${job.description || ""}`;
  const fromFull = parseSalaryFromText(blob);
  const parsed = fromFull.salary_present ? fromFull : detectAndParseSalaryForGreenhouse(blob);
  if (!parsed.salary_present) return null;
  const mid =
    parsed.salary_amount_min != null && parsed.salary_amount_max != null
      ? (parsed.salary_amount_min + parsed.salary_amount_max) / 2
      : parsed.salary_amount_min ?? parsed.salary_amount_max;
  if (mid == null) return null;
  if (parsed.salary_period === "month") return mid * 12;
  if (parsed.salary_period === "hour") return mid * 2080;
  if (parsed.salary_period === "day") return mid * 260;
  return mid;
}

export function salaryBucketsFromJobs(jobs: Array<Pick<Job, "salary" | "description" | "category">>): SalaryBucket[] {
  const byCat = new Map<string, number[]>();
  jobs.forEach((job) => {
    const amount = yearlyAmount(job);
    if (amount == null) return;
    const key = job.category || "Operations";
    const list = byCat.get(key) || [];
    list.push(amount);
    byCat.set(key, list);
  });
  const out: SalaryBucket[] = [];
  byCat.forEach((amounts, category) => {
    if (amounts.length < 3) return;
    out.push({
      category,
      label: CATEGORY_FILTER_LABELS[category] || category,
      count: amounts.length,
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      median: median(amounts),
    });
  });
  return out.sort((a, b) => b.count - a.count);
}
