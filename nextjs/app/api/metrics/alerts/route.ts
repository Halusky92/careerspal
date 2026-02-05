import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { count } = await supabaseAdmin.from("alerts").select("*", { count: "exact", head: true });
  return NextResponse.json({ alerts: count || 0 });
}
