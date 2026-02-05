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

  const { data: users } = await supabaseAdmin.from("profiles").select("role");
  const summary = (users || []).reduce<Record<string, number>>((acc, user) => {
    if (!user.role) return acc;
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ summary });
}
