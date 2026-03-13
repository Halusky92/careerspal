import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { ingestGreenhouseRawJobs } from "../../../../../../lib/sourcing/pipeline/greenhouseSteps";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string };
  const sourceId = (body.sourceId || "").trim() || null;

  try {
    const out = await ingestGreenhouseRawJobs(supabaseAdmin, { sourceId });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Run failed." }, { status: 500 });
  }
}

