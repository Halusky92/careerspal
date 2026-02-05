import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const [users, jobs, savedJobs, files] = await Promise.all([
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("jobs").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("saved_jobs").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("files").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    users: users.count || 0,
    jobs: jobs.count || 0,
    savedJobs: savedJobs.count || 0,
    files: files.count || 0,
  });
}
