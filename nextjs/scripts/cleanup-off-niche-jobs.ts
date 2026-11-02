import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isOnNicheJob, offNicheReason } from "../lib/nicheScope";

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

async function main() {
  const { data: jobs, error } = await supabase.from("jobs").select("id,title,category,description,status").eq("status", "published");
  if (error) throw new Error(error.message);

  const off = (jobs || []).filter((j) => !isOnNicheJob(j));
  console.log(`scanned=${jobs?.length || 0} off_niche=${off.length}`);
  for (const job of off.slice(0, 20)) {
    console.log(`- ${job.title} | ${job.category} | ${offNicheReason(job)}`);
  }

  if (!off.length) return;

  const ids = off.map((j) => j.id);
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100);
    const { error: updErr } = await supabase.from("jobs").update({ status: "draft", published_at: null }).in("id", group);
    if (updErr) throw new Error(updErr.message);
  }
  console.log(`unpublished=${ids.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
