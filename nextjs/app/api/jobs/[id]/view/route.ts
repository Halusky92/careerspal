import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { classifyListingSource } from "../../../../../lib/listingTraffic";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const hashIp = (ip: string, jobId: string) =>
  createHash("sha256").update(`${ip}:${jobId}`).digest("hex").slice(0, 32);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: job } = await supabaseAdmin.from("jobs").select("id,views").eq("id", id).single();
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
  const ipHash = ip ? hashIp(ip, job.id) : null;
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

  if (ipHash) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("job_views")
      .select("id")
      .eq("job_id", job.id)
      .eq("ip_hash", ipHash)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json({ views: job.views || 0, duplicate: true });
    }
  }

  const nextViews = (job.views || 0) + 1;
  await supabaseAdmin.from("jobs").update({ views: nextViews }).eq("id", id);
  await supabaseAdmin.from("job_views").insert({
    job_id: job.id,
    ip_hash: ipHash,
    user_agent: userAgent || null,
  }).then(() => undefined);
  await supabaseAdmin.from("audit_logs").insert({
    action: "view",
    job_id: job.id,
    metadata: { views: nextViews, source, referrer: referrer.slice(0, 240), path: path.slice(0, 240) },
  }).then(() => undefined);

  return NextResponse.json({ views: nextViews });
}
