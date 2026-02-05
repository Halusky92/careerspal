import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { name?: string };
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Invalid name." }, { status: 400 });
  }

  const { data: updated } = await supabaseAdmin
    .from("profiles")
    .update({ full_name: body.name.trim(), is_onboarded: true })
    .eq("id", auth.profile.id)
    .select("full_name")
    .single();

  return NextResponse.json({ name: updated?.full_name || body.name.trim() });
}
