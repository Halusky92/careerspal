import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { count } = await supabaseAdmin
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .ilike("posted_at_text", "%day%");
  return NextResponse.json({ recent: count || 0 });
}
