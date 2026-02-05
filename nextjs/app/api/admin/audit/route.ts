import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: logs } = await supabaseAdmin
    .from("audit_logs")
    .select("id, actor_id, job_id, action, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ logs: logs || [] });
}
