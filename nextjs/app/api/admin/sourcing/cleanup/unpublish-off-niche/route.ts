import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { isOnNicheJob, offNicheReason } from "../../../../../../lib/nicheScope";

export const runtime = "nodejs";

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id,title,category,description,status")
    .eq("status", "published");

  if (error) {
    return NextResponse.json({ error: `Unable to load jobs: ${error.message}` }, { status: 500 });
  }

  const off = (jobs || []).filter((j) => !isOnNicheJob(j));
  const jobIds = off.map((j) => j.id).filter(Boolean);

  for (const group of chunk(jobIds, 100)) {
    const { error: updErr } = await supabaseAdmin
      .from("jobs")
      .update({ status: "draft", published_at: null })
      .in("id", group);
    if (updErr) {
      return NextResponse.json({ error: `Unable to unpublish jobs: ${updErr.message}` }, { status: 500 });
    }
  }

  if (jobIds.length) {
    await supabaseAdmin.from("audit_logs").insert(
      off.slice(0, 200).map((job) => ({
        actor_id: auth.profile.id,
        job_id: job.id,
        action: "unpublished_off_niche",
        metadata: { reason: offNicheReason(job), title: job.title, category: job.category },
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    scanned: (jobs || []).length,
    unpublished: jobIds.length,
    samples: off.slice(0, 25).map((j) => ({ id: j.id, title: j.title, category: j.category, reason: offNicheReason(j) })),
  });
}
