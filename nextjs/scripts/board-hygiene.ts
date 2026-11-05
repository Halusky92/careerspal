import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expireStaleJobs } from "../lib/jobs/expireStaleJobs";
import { purgeSourcingDebrisUntilEmpty } from "../lib/jobs/purgeSourcingDebris";
import { sweepDeadApplyLinks } from "../lib/jobs/sweepDeadApplyLinks";

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

const dryRun = (process.env.DRY_RUN || "").toLowerCase() === "true";

const run = async () => {
  const expired = await expireStaleJobs(supabase, { dryRun });
  console.log("expired", expired);

  const debris = await purgeSourcingDebrisUntilEmpty(supabase, { dryRun });
  console.log("sourcingDebris", debris);

  let deadTotal = 0;
  let offset = 0;
  let passes = 0;
  while (passes < 50) {
    const slice = await sweepDeadApplyLinks(supabase, { dryRun, limit: 25, offset, timeoutMs: 8000 });
    console.log("deadLinks", slice);
    deadTotal += slice.deleted;
    passes += 1;
    if (slice.scanned === 0) break;
    if (dryRun || slice.deleted === 0) offset += slice.scanned;
    if (slice.scanned < 25) break;
  }
  console.log({ dryRun, deadTotal });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
