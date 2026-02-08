import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

type JobRow = {
  id: string;
  title: string | null;
  apply_url: string | null;
  status: string | null;
};

const STALE_PHRASES = [
  "job not found",
  "this job is no longer available",
  "no longer available",
  "no longer accepting applications",
  "position has been filled",
  "role has been filled",
  "job has expired",
  "opportunity is closed",
  "this position has been closed",
  "the job posting you were looking for does not exist",
];

const shouldSkipUrl = (value?: string | null) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return true;
  if (trimmed === "#") return true;
  if (trimmed.startsWith("mailto:")) return true;
  if (trimmed.startsWith("/")) return true;
  return false;
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const isStaleByContent = (text: string) => {
  const normalized = text.toLowerCase();
  return STALE_PHRASES.some((phrase) => normalized.includes(phrase));
};

const checkJobUrl = async (url: string) => {
  const normalized = normalizeUrl(url);

  try {
    const head = await fetchWithTimeout(normalized, { method: "HEAD", redirect: "follow" }, 10000);
    if (head.status === 404 || head.status === 410) return { stale: true, reason: `status ${head.status}` };
    if (head.status >= 400 && head.status < 500) {
      return { stale: false, reason: `status ${head.status}` };
    }
  } catch {
    // Ignore HEAD failures; fallback to GET.
  }

  try {
    const response = await fetchWithTimeout(normalized, { method: "GET", redirect: "follow" }, 15000);
    if (response.status === 404 || response.status === 410) {
      return { stale: true, reason: `status ${response.status}` };
    }
    if (response.status >= 500) {
      return { stale: false, reason: `status ${response.status}` };
    }
    const text = (await response.text()).slice(0, 120000);
    if (isStaleByContent(text)) {
      return { stale: true, reason: "stale content" };
    }
    return { stale: false, reason: "ok" };
  } catch (error) {
    return { stale: false, reason: "fetch error" };
  }
};

const run = async () => {
  const dryRun = (process.env.DRY_RUN || "").toLowerCase() === "true";
  const pageSize = 100;
  let offset = 0;
  const jobs: JobRow[] = [];

  while (true) {
    const { data } = await supabase
      .from("jobs")
      .select("id,title,apply_url,status")
      .eq("status", "published")
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;
    jobs.push(...(data as JobRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  let checked = 0;
  let deleted = 0;
  let skipped = 0;

  for (const job of jobs) {
    const applyUrl = job.apply_url || "";
    if (shouldSkipUrl(applyUrl)) {
      skipped += 1;
      continue;
    }
    checked += 1;
    const result = await checkJobUrl(applyUrl);
    if (!result.stale) continue;

    if (dryRun) {
      console.log(`[DRY RUN] Delete ${job.id} (${job.title || "Untitled"}) - ${result.reason}`);
      deleted += 1;
      continue;
    }

    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
    if (error) {
      console.error(`Failed to delete ${job.id}:`, error.message);
      continue;
    }
    console.log(`Deleted ${job.id} (${job.title || "Untitled"}) - ${result.reason}`);
    deleted += 1;
  }

  console.log(`Checked ${checked} jobs. Skipped ${skipped}. Deleted ${deleted}.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
