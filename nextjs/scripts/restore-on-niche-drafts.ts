import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isOnNicheJob } from "../lib/nicheScope";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

async function main() {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id,title,category,description,status,updated_at")
    .eq("status", "draft")
    .gte("updated_at", since);
  if (error) throw new Error(error.message);

  const restore = (jobs || []).filter((j) => isOnNicheJob(j));
  console.log(`recent drafts=${jobs?.length || 0} restore=${restore.length}`);
  for (const job of restore.slice(0, 25)) {
    console.log(`+ ${job.title} | ${job.category}`);
  }
  if (!restore.length) return;

  const ids = restore.map((j) => j.id);
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100);
    const { error: updErr } = await supabase
      .from("jobs")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", group);
    if (updErr) throw new Error(updErr.message);
  }
  console.log(`restored=${ids.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
