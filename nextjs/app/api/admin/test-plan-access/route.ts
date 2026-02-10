import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const isEmailAllowed = (email?: string | null) => {
  if (!email) return false;
  const allowList = (process.env.ADMIN_TEST_EMAILS || "mb.bilek@gmail.com")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.toLowerCase());
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile || auth.profile.role !== "admin") {
    return NextResponse.json({ allowed: false }, { status: 403 });
  }
  const allowed = isEmailAllowed(auth.profile.email);
  return NextResponse.json({ allowed });
}
