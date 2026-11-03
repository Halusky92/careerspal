import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { maybeAutoPublishListing } from "../../../../../lib/jobs/autoReviewListing";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data } = await supabaseAdmin.from("jobs").select("id").eq("status", "pending_review").limit(40);
  const ids = (data || []).map((row) => String((row as { id: string }).id));
  let published = 0;
  let held = 0;
  for (const id of ids) {
    const result = await maybeAutoPublishListing(supabaseAdmin, id, auth.profile.id);
    if (result.status === "published") published += 1;
    else held += 1;
  }

  return NextResponse.json({ ok: true, scanned: ids.length, published, held });
}
