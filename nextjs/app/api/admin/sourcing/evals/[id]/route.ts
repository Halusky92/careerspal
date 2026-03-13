import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const params = await ctx.params;
  const id = (params.id || "").trim();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sourcing_sourced_job_candidates")
    .select(
      "*," +
        "sourcing_candidate_scores(*)," +
        // Disambiguate relationship: sourcing_candidate_dedupes has 2 FKs to candidates (candidate_id + duplicate_of_candidate_id)
        "sourcing_candidate_dedupes!sourcing_candidate_dedupes_candidate_id_fkey(*)," +
        "sourcing_candidate_decisions(*)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ eval: data });
}

