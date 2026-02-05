import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

const ALLOWED_ROLES = new Set(["candidate", "employer"]);

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { role?: string };
  if (!body.role || !ALLOWED_ROLES.has(body.role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { data: updated } = await supabaseAdmin
    .from("profiles")
    .update({ role: body.role })
    .eq("id", auth.profile.id)
    .select("role")
    .single();

  if (!updated) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ role: updated.role });
}
