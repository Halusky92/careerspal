import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { planIndexNotifications } from "../lib/googleIndexing/plan";
import { toIndexSnapshot, type IndexJobRow } from "../lib/googleIndexing/snapshot";

const envPath = process.env.CP_ENV_FILE || "";
if (envPath) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    if (process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) {
  console.log(JSON.stringify({ ok: false, aborted: "database_not_configured" }));
  process.exit(1);
}

async function main() {
const sb = createClient(url, key, { auth: { persistSession: false } });
const select =
  "id,title,description,location,remote_policy,type,salary,timestamp,published_at,created_at,category,apply_url,status,content_hash,companies(name)";
const rows: IndexJobRow[] = [];
const pageSize = 200;
let offset = 0;
let complete = true;
while (offset <= 20000) {
  const page = await sb.from("jobs").select(select).range(offset, offset + pageSize - 1);
  if (page.error) {
    complete = false;
    break;
  }
  const chunk = (page.data || []) as IndexJobRow[];
  rows.push(...chunk);
  if (chunk.length < pageSize) break;
  offset += pageSize;
}
const historyPage = await sb
  .from("google_index_notifications")
  .select("url,job_id,notice_type,fingerprint,sent_at")
  .eq("state", "sent")
  .limit(5000);
const historyReady = !historyPage.error;
const history = historyReady
  ? (historyPage.data || []).flatMap((row) =>
      row.url && (row.notice_type === "URL_UPDATED" || row.notice_type === "URL_DELETED")
        ? [{
            url: row.url,
            jobId: row.job_id,
            type: row.notice_type,
            fingerprint: row.fingerprint || "",
            sentAt: row.sent_at || "",
          }]
        : [],
    )
  : null;
const plan = planIndexNotifications({
  jobs: complete ? rows.map(toIndexSnapshot) : null,
  jobsReadOk: complete,
  scanComplete: complete,
  history,
  historyReadOk: historyReady,
  sentToday: 0,
});
const visible = plan.updated.filter((item) => item.url.startsWith("https://www.careerspal.com/jobs/")).length;
console.log(
  JSON.stringify({
    ok: plan.aborted == null,
    dryRun: true,
    liveSending: plan.liveSending,
    aborted: plan.aborted,
    scanned: complete ? rows.length : null,
    historyReady,
    totalUpdated: plan.totalUpdated,
    totalDeleted: plan.totalDeleted,
    batchUpdated: plan.batchUpdated,
    batchDeleted: plan.batchDeleted,
    deferred: plan.deferred,
    skippedUnchanged: plan.skippedUnchanged,
    wwwUrls: visible,
    jobPostings: complete ? rows.map(toIndexSnapshot).filter((job) => job.visibility === "job_posting").length : null,
  }),
);
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, aborted: "dry_run_failed" }));
  process.exit(1);
});
