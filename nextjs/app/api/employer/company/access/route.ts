import { NextResponse } from "next/server";
import { requireEmployer } from "../../../../../lib/employer";
import { createAccessRequest, matchExistingCompany, membershipTableReady } from "../../../../../lib/companyAccessDb";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "";
  const website = searchParams.get("website") || "";
  const ready = await membershipTableReady(supabaseAdmin!);
  if (!ready) return NextResponse.json({ match: null, ready: false });
  const matched = await matchExistingCompany(supabaseAdmin!, { name, website });
  const match = matched.match;
  if (!match || match.status === "none") return NextResponse.json({ match: null });
  if (match.status === "ambiguous") return NextResponse.json({ match: null, ambiguous: true });
  return NextResponse.json({
    match: { companyId: match.companyId, name: match.name, kind: match.kind },
    message: "This company is already listed. Request access to post jobs under its existing profile.",
  });
}

export async function POST(request: Request) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const session = await getSupabaseProfile(request);
  const body = (await request.json()) as { companyId?: string; evidence?: string };
  const companyId = (body.companyId || "").trim();
  if (!companyId) return NextResponse.json({ error: "Company id is required." }, { status: 400 });
  const company = await supabaseAdmin!.from("companies").select("id,name,website,slug").eq("id", companyId).maybeSingle();
  if (!company.data?.id) return NextResponse.json({ error: "Company not found." }, { status: 404 });
  const created = await createAccessRequest(supabaseAdmin!, {
    companyId,
    profileId: auth.profileId,
    email: auth.email || "",
    emailVerified: Boolean(session?.user.email_confirmed_at),
    companyWebsite: company.data.website,
    evidence: body.evidence,
  });
  if (created.error === "save_failed") {
    return NextResponse.json({ error: "Company access is not available until the database migration is applied." }, { status: 503 });
  }
  if (created.error === "already_member") {
    return NextResponse.json({ error: "You already have access to this company." }, { status: 409 });
  }
  if (created.error === "unverified_email") {
    return NextResponse.json({ error: "Confirm your email before requesting access." }, { status: 403 });
  }
  if (created.error) return NextResponse.json({ error: "Unable to request access." }, { status: 400 });
  return NextResponse.json({
    request: created.request,
    company: { id: company.data.id, name: company.data.name, slug: company.data.slug },
    message: "Request sent. Payment stays closed until an admin approves access.",
  });
}
