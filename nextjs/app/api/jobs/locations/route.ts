import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { locationLabelsForJobs } from "../../../../lib/locationFilter";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("location, remote_policy")
    .eq("status", "published");

  const locations = locationLabelsForJobs(
    (jobs || []).map((job) => ({
      location: job.location || "",
      remotePolicy: (job as { remote_policy?: string }).remote_policy || "",
    })),
  ).filter((location) => (q ? location.toLowerCase().includes(q) : true));
  return NextResponse.json(
    { locations },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
