import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { enrichCandidatesSalaryBulk } from "../../../../../../lib/sourcing/pipeline/salaryEnrichment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const sb = supabaseAdmin;

  const body = (await request.json().catch(() => ({}))) as any;
  try {
    const summary = await enrichCandidatesSalaryBulk(sb, {
      sourceId: typeof body.sourceId === "string" ? body.sourceId : null,
      runId: typeof body.runId === "string" ? body.runId : null,
      limit: body.limit,
      concurrency: body.concurrency,
      cooldownHours: body.cooldownHours,
      scanLimit: body.scanLimit,
    });
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Salary enrichment failed" }, { status: 500 });
  }
}

