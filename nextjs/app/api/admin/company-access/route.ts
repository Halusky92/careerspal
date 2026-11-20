import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { reviewAccessRequest } from "../../../../lib/companyAccessDb";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

async function requireAdmin(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin" || !supabaseAdmin) return null;
  return auth;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin!
    .from("company_access_requests")
    .select("id,company_id,profile_id,email,email_domain,email_verified,match_kind,status,evidence,decision_note,created_at,companies(name,slug,website)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ requests: [], ready: false });
  return NextResponse.json({ requests: data || [], ready: true });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    requestId?: string;
    action?: "approve" | "reject" | "revoke";
    role?: "admin" | "poster";
    note?: string;
  };
  if (!body.requestId || !body.action) {
    return NextResponse.json({ error: "Request id and action are required." }, { status: 400 });
  }
  const result = await reviewAccessRequest(supabaseAdmin!, {
    requestId: body.requestId,
    adminId: auth.profile.id,
    action: body.action,
    role: body.role,
    note: body.note,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ status: result.status });
}
