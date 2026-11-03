import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isOnNicheJob } from "../lib/nicheScope";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase env.");

const sb = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

async function main() {
  const { data: companies, error } = await sb
    .from("companies")
    .select("id,name,slug,website,logo_url,created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;

  const ids = (companies || []).map((c) => c.id);
  const { data: jobs } = await sb
    .from("jobs")
    .select("id,title,category,status,company_id,timestamp")
    .in("company_id", ids)
    .order("timestamp", { ascending: false })
    .limit(40);

  const out = (companies || []).map((c) => {
    const companyJobs = (jobs || []).filter((j) => j.company_id === c.id);
    return {
      name: c.name,
      slug: c.slug,
      website: c.website,
      hasLogo: Boolean((c.logo_url || "").trim()),
      created_at: c.created_at,
      jobs: companyJobs.map((j) => ({
        title: j.title,
        category: j.category,
        status: j.status,
        onNiche: isOnNicheJob({ title: j.title, category: j.category, description: null }),
      })),
    };
  });
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
