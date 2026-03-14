import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const clampInt = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(v)));
};

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
  const sb = supabaseAdmin;
  const actorId = auth.profile.id;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const maxToProcess = clampInt(body.maxToProcess, 1, 2000, 1000);

  // Thresholds (conservative defaults) – meant to catch "$1-$2" style mistakes.
  const minHour = clampInt(body.minHour, 0, 500, 10);
  const minDay = clampInt(body.minDay, 0, 5000, 80);
  const minMonth = clampInt(body.minMonth, 0, 100000, 1500);
  const minYear = clampInt(body.minYear, 0, 1000000, 20000);
  const minAny = clampInt(body.minAny, 0, 500, 10); // fallback when period is missing

  if (!sourceId) return NextResponse.json({ error: "Missing sourceId." }, { status: 400 });

  const { data: candRows, error: candErr } = await sb
    .from("sourcing_sourced_job_candidates")
    .select("id,source_id,published_job_id,salary_amount_min,salary_amount_max,salary_period")
    .eq("source_id", sourceId)
    .not("published_job_id", "is", null)
    .limit(maxToProcess);

  if (candErr) return NextResponse.json({ error: `Unable to load candidates: ${candErr.message}` }, { status: 500 });

  const published = (candRows || []).filter((r: any) => !!r.published_job_id);
  const isLow = (r: any) => {
    const period = (r.salary_period || "").toString().toLowerCase();
    const floor =
      period === "hour"
        ? minHour
        : period === "day"
          ? minDay
          : period === "month"
            ? minMonth
            : period === "year"
              ? minYear
              : minAny;
    const lo = typeof r.salary_amount_min === "number" ? r.salary_amount_min : null;
    const hi = typeof r.salary_amount_max === "number" ? r.salary_amount_max : null;
    const loBad = lo != null && lo > 0 && lo < floor;
    const hiBad = hi != null && hi > 0 && hi < floor;
    return loBad || hiBad;
  };

  const low = published.filter(isLow);
  if (!low.length) {
    return NextResponse.json({ ok: true, scanned: published.length, unpublished_jobs: 0, reason: "none_implausible" });
  }

  const jobIds = Array.from(new Set(low.map((c: any) => c.published_job_id).filter(Boolean))) as string[];

  const { error: jobsErr } = await sb.from("jobs").update({ status: "draft", published_at: null }).in("id", jobIds);
  if (jobsErr) return NextResponse.json({ error: `Unable to unpublish jobs: ${jobsErr.message}` }, { status: 500 });

  // Mark candidates (small batches expected)
  for (const c of low) {
    await sb
      .from("sourcing_sourced_job_candidates")
      .update({
        publish_status: "unpublished_implausible_salary",
        publish_notes: `Unpublished: implausible salary (period=${(c.salary_period || "—").toString()}, min=${c.salary_amount_min ?? "—"}, max=${c.salary_amount_max ?? "—"}).`,
      })
      .eq("id", c.id);
  }

  // Audit
  await sb.from("audit_logs").insert(
    jobIds.map((jobId) => ({
      actor_id: actorId,
      job_id: jobId,
      action: "sourcing_unpublished_implausible_salary",
      metadata: { sourceId, floors: { minHour, minDay, minMonth, minYear, minAny }, candidates: low.length },
    })),
  );

  return NextResponse.json({
    ok: true,
    scanned: published.length,
    implausible: low.length,
    unpublished_jobs: jobIds.length,
    jobIds,
  });
}

