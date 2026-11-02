import { NextResponse } from "next/server";
import { classifyListingSource } from "../../../../../lib/listingTraffic";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: job } = await supabaseAdmin.from("jobs").select("id,matches").eq("id", id).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let body: { source?: string; referrer?: string; path?: string; sessionId?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    body = {};
  }

  const referrer = body.referrer || request.headers.get("referer") || "";
  const path = body.path || "";
  const source =
    body.source ||
    classifyListingSource({
      path,
      referrer,
      utm: path.includes("utm_source=")
        ? new URLSearchParams(path.split("?")[1] || "").get("utm_source")
        : null,
    });

  const nextMatches = (job.matches || 0) + 1;
  await supabaseAdmin.from("jobs").update({ matches: nextMatches }).eq("id", id);
  await supabaseAdmin.from("job_matches").insert({
    job_id: job.id,
    score: null,
  }).then(() => undefined);
  await supabaseAdmin.from("audit_logs").insert({
    action: "apply_click",
    job_id: job.id,
    metadata: {
      applyClicks: nextMatches,
      matches: nextMatches,
      source,
      referrer: referrer.slice(0, 240),
      path: path.slice(0, 240),
    },
  });

  return NextResponse.json({ applyClicks: nextMatches, matches: nextMatches });
}
