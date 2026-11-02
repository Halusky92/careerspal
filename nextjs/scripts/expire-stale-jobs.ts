import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expireStaleJobs } from "../lib/jobs/expireStaleJobs";

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

expireStaleJobs(supabase, { dryRun: (process.env.DRY_RUN || "").toLowerCase() === "true" })
  .then((summary) => {
    console.log(summary);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
