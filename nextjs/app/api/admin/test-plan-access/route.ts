import { NextResponse } from "next/server";
import { canUseAdminTestPlan } from "../../../../lib/adminTestPlan";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ allowed: false }, { status: 403 });
  }
  const allowed = canUseAdminTestPlan({ role: auth.profile.role, email: auth.profile.email });
  if (!allowed) {
    return NextResponse.json({ allowed: false }, { status: 403 });
  }
  return NextResponse.json({ allowed: true, price: 1 });
}
