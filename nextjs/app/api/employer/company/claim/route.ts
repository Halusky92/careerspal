import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireEmployer } from "../../../../../lib/employer";

export async function POST(request: Request) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { companyId?: string; name?: string };
  const companyId = (body.companyId || "").trim();
  const name = (body.name || "").trim();
  if (!companyId && !name) {
    return NextResponse.json({ error: "Company id or name is required." }, { status: 400 });
  }

  let query = supabaseAdmin!.from("companies").select("id,name,slug,claimed_by,created_by,website");
  if (companyId) query = query.eq("id", companyId);
  else query = query.ilike("name", name);

  const { data: company } = await query.limit(1).maybeSingle();
  if (!company?.id) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const claimedBy = (company as { claimed_by?: string | null }).claimed_by;
  const createdBy = (company as { created_by?: string | null }).created_by;
  if (claimedBy && claimedBy !== auth.profileId) {
    return NextResponse.json({ error: "This company profile is already claimed." }, { status: 409 });
  }
  if (createdBy && createdBy !== auth.profileId) {
    return NextResponse.json(
      { error: "This company profile is already on the board. Post new jobs under your own company." },
      { status: 409 },
    );
  }

  const { data: updated, error } = await supabaseAdmin!
    .from("companies")
    .update({ claimed_by: auth.profileId })
    .eq("id", company.id)
    .select("id,name,slug")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Unable to claim this company." }, { status: 500 });
  }

  await supabaseAdmin!.from("audit_logs").insert({
    action: "company_claimed",
    actor_id: auth.profileId,
    metadata: { companyId: updated.id, name: updated.name },
  });

  return NextResponse.json({
    company: updated,
    note: "Claiming a profile does not attach sourced Greenhouse listings to your dashboard.",
  });
}
