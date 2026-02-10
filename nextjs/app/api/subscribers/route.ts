import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { email?: string; preference?: string };
  const email = (body.email || "").trim().toLowerCase();
  const preference = (body.preference || "All").trim();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .upsert(
      { email, preference },
      { onConflict: "email" },
    )
    .select("email,preference,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Unable to subscribe." }, { status: 500 });
  }

  return NextResponse.json({ message: "Welcome to the Elite list.", subscriber: data });
}
