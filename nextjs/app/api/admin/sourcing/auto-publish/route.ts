import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { autoPublishEligibleCandidates } from "../../../../../lib/sourcing/pipeline/greenhouseSteps";

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
  const limit = Math.min(300, Math.max(1, Number(body.limit) || 100));

  try {
    const out = await autoPublishEligibleCandidates(supabaseAdmin, {
      actorId: auth.profile.id,
      sourceId,
      runId,
      limit,
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auto-publish failed." }, { status: 500 });
  }
}

