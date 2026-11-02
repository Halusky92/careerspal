import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() || "";
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  await supabaseAdmin.from("subscribers").delete().eq("email", email);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.careerspal.com";
  return NextResponse.redirect(`${site.replace(/\/+$/, "")}/alerts`);
}

export async function POST() {
  return NextResponse.json({ success: true });
}
