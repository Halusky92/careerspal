import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { sendDigest } from "../../../../../lib/alerts/sendDigest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  const result = await sendDigest({ dryRun: Boolean(body.dryRun), force: true, trial: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
