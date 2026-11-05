import { NextResponse } from "next/server";
import { classifyListingSource } from "../../../../../lib/listingTraffic";
import { uniqueViewerFromRequest } from "../../../../../lib/jobViews";
import { getSupabaseUser } from "../../../../../lib/supabaseServerAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: job } = await supabaseAdmin.from("jobs").select("id,views,created_by").eq("id", id).single();
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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const user = await getSupabaseUser(request);
  const identity = uniqueViewerFromRequest({
    jobId: job.id,
    userId: user?.id,
    sessionId: body.sessionId,
    ip,
  });
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 180);
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
  const currentViews = job.views || 0;

  if (job.created_by && identity.viewerId && job.created_by === identity.viewerId) {
    return NextResponse.json({ views: currentViews, owner: true });
  }

  if (!identity.viewerId && !identity.fingerprint) {
    return NextResponse.json({ views: currentViews, skipped: true });
  }

  if (identity.viewerId) {
    const { data: recent } = await supabaseAdmin
      .from("job_views")
      .select("id")
      .eq("job_id", job.id)
      .eq("viewer_id", identity.viewerId)
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json({ views: currentViews, duplicate: true });
    }
  } else if (identity.fingerprint) {
    const { data: recent } = await supabaseAdmin
      .from("job_views")
      .select("id")
      .eq("job_id", job.id)
      .eq("ip_hash", identity.fingerprint)
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json({ views: currentViews, duplicate: true });
    }
  }

  const nextViews = currentViews + 1;
  let inserted = await supabaseAdmin.from("job_views").insert({
    job_id: job.id,
    viewer_id: identity.viewerId,
    ip_hash: identity.fingerprint,
    user_agent: userAgent || null,
  });
  if (inserted.error && identity.viewerId) {
    inserted = await supabaseAdmin.from("job_views").insert({
      job_id: job.id,
      viewer_id: null,
      ip_hash: identity.fingerprint,
      user_agent: userAgent || null,
    });
  }
  if (inserted.error) {
    return NextResponse.json({ views: currentViews, duplicate: true });
  }
  await supabaseAdmin.from("jobs").update({ views: nextViews }).eq("id", id);
  await supabaseAdmin
    .from("audit_logs")
    .insert({
      action: "view",
      job_id: job.id,
      metadata: { views: nextViews, source, referrer: referrer.slice(0, 240), path: path.slice(0, 240) },
    })
    .then(() => undefined);

  return NextResponse.json({ views: nextViews });
}
