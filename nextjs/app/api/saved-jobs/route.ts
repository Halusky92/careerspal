import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "0");
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined;

  const profileId = auth.profile.id;

  const { data } = await supabaseAdmin
    .from("saved_jobs")
    .select("job_id, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .range(0, take ? take - 1 : 999);

  return NextResponse.json(
    { savedJobs: (data || []).map((row) => ({ jobId: row.job_id, createdAt: row.created_at })) },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { jobId?: string };
  if (!body.jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const profileId = auth.profile.id;

  const { data: job } = await supabaseAdmin.from("jobs").select("id").eq("id", body.jobId).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  const { data: saved } = await supabaseAdmin
    .from("saved_jobs")
    .upsert({ user_id: profileId, job_id: body.jobId }, { onConflict: "user_id,job_id" })
    .select("user_id, job_id, created_at")
    .single();
  return NextResponse.json({ savedJob: saved }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { jobId?: string };
  if (!body.jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const profileId = auth.profile.id;
  await supabaseAdmin
    .from("saved_jobs")
    .delete()
    .eq("user_id", profileId)
    .eq("job_id", body.jobId);
  return NextResponse.json({ success: true });
}
