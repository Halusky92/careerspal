import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

async function main() {
  const originProbe = await supabase.from("jobs").select("id,origin").limit(1);
  const claimedProbe = await supabase.from("companies").select("id,claimed_by,founding_expires_at").limit(1);
  console.log(`jobs.origin=${originProbe.error ? "MISSING" : "ok"}`);
  console.log(`companies.claim=${claimedProbe.error ? "MISSING" : "ok"}`);

  if (!originProbe.error) {
    const sourced = await supabase
      .from("sourcing_sourced_job_candidates")
      .select("published_job_id")
      .not("published_job_id", "is", null);
    const ids = Array.from(
      new Set((sourced.data || []).map((row) => row.published_job_id).filter(Boolean)),
    ) as string[];
    for (let i = 0; i < ids.length; i += 100) {
      const group = ids.slice(i, i + 100);
      await supabase.from("jobs").update({ origin: "greenhouse" }).in("id", group);
    }
    console.log(`marked_greenhouse=${ids.length}`);
  } else {
    console.log("Apply supabase/migrations/20261102_employer_dashboard.sql in the Supabase SQL editor.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
