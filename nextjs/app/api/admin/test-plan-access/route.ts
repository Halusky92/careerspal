import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || null;
};

const isIpAllowed = (ip: string | null) => {
  if (!ip) return false;
  const allowList = (process.env.ADMIN_TEST_IPS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return allowList.includes(ip);
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile || auth.profile.role !== "admin") {
    return NextResponse.json({ allowed: false }, { status: 403 });
  }
  const ip = getClientIp(request);
  const allowed = isIpAllowed(ip);
  return NextResponse.json({ allowed });
}
