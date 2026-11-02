import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { parseSalaryFromText } from "../lib/sourcing/normalization/salary";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

async function main() {
  const { data: jobs, error } = await supabase.from("jobs").select("id,title,salary,status").eq("status", "published");
  if (error) throw new Error(error.message);

  const bad = (jobs || []).filter((job) => {
    const parsed = parseSalaryFromText(job.salary || "");
    const max = parsed.salary_amount_max ?? parsed.salary_amount_min ?? 0;
    const period = parsed.salary_period;
    if (!parsed.salary_present) return /\$?\s*\d+(\.\d+)?\s*m\b/i.test(job.salary || "");
    if (period === "year" && max > 800_000) return true;
    if (period === "month" && max > 80_000) return true;
    return false;
  });

  console.log(`scanned=${jobs?.length || 0} implausible=${bad.length}`);
  for (const job of bad.slice(0, 25)) {
    console.log(`- ${job.title} | ${job.salary}`);
  }
  if (!bad.length) return;

  const ids = bad.map((job) => job.id);
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100);
    const { error: updErr } = await supabase
      .from("jobs")
      .update({ status: "draft", published_at: null })
      .in("id", group);
    if (updErr) throw new Error(updErr.message);
  }
  console.log(`unpublished=${ids.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
