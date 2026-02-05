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

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role, is_onboarded, created_at")
    .order("created_at", { ascending: false });
  const users =
    (data || []).map((user) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      isOnboarded: user.is_onboarded,
      createdAt: user.created_at,
    })) || [];

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { userId?: string; role?: string };
  if (!body.userId || !body.role) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const { data: updated } = await supabaseAdmin
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.userId)
    .select("id, full_name, email, role, is_onboarded")
    .single();

  return NextResponse.json({
    user: updated
      ? {
          id: updated.id,
          name: updated.full_name,
          email: updated.email,
          role: updated.role,
          isOnboarded: updated.is_onboarded,
        }
      : null,
  });
}
