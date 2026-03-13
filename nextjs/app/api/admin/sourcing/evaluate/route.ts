import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { evaluateCandidates } from "../../../../../lib/sourcing/pipeline/greenhouseSteps";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string; runId?: string; limit?: number };
  const sourceId = (body.sourceId || "").trim();
  const runId = (body.runId || "").trim();
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));

  try {
    const out = await evaluateCandidates(supabaseAdmin, { sourceId, runId, limit });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Evaluation failed." }, { status: 500 });
  }
}

