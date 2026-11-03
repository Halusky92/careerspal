import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { toPublicPerson } from "../../../../lib/publicPerson";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const role = auth.profile.role;
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  let jobQuery = supabaseAdmin.from("jobs").select("id, title, created_by, status");
  if (role === "admin") {
    if (jobId) jobQuery = jobQuery.eq("id", jobId);
  } else if (role === "employer") {
    jobQuery = jobQuery.eq("created_by", auth.profile.id);
    if (jobId) jobQuery = jobQuery.eq("id", jobId);
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: jobs } = await jobQuery.limit(80);
  const jobIds = (jobs || []).map((job) => job.id);
  if (jobIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("job_shortlist")
    .select("id, job_id, profile_id, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ items: [] });
  }

  const profileIds = Array.from(new Set((rows || []).map((row) => row.profile_id)));
  const { data: profiles } = profileIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url, headline, bio, hobbies, profile_share_token, profile_visibility")
        .in("id", profileIds)
    : { data: [] as never[] };

  const peopleById = new Map((profiles || []).map((person) => [person.id, person]));
  const jobById = new Map((jobs || []).map((job) => [job.id, job]));

  const items = (rows || []).map((row) => {
    const person = peopleById.get(row.profile_id);
    const job = jobById.get(row.job_id);
    return {
      id: row.id,
      jobId: row.job_id,
      jobTitle: job?.title || "Role",
      person: person ? toPublicPerson(person) : null,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { jobId?: string; profileId?: string };
  if (!body.jobId || !body.profileId) {
    return NextResponse.json({ error: "jobId and profileId required." }, { status: 400 });
  }

  const { data: person } = await supabaseAdmin
    .from("profiles")
    .select("id, profile_visibility")
    .eq("id", body.profileId)
    .maybeSingle();
  if (!person || person.profile_visibility !== "employers") {
    return NextResponse.json({ error: "This seeker is not visible to employers." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("job_shortlist").insert({
    job_id: body.jobId,
    profile_id: body.profileId,
    created_by: auth.profile.id,
  });
  if (error && !String(error.message || "").includes("duplicate")) {
    return NextResponse.json({ error: "Could not attach seeker." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const body = (await request.json()) as { jobId?: string; profileId?: string };
  if (!body.jobId || !body.profileId) {
    return NextResponse.json({ error: "jobId and profileId required." }, { status: 400 });
  }
  await supabaseAdmin.from("job_shortlist").delete().eq("job_id", body.jobId).eq("profile_id", body.profileId);
  return NextResponse.json({ ok: true });
}
