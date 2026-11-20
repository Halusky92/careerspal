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

  let query = supabaseAdmin!.from("companies").select("id,name,slug");
  if (companyId) query = query.eq("id", companyId);
  else query = query.ilike("name", name);
  const { data: company } = await query.limit(1).maybeSingle();
  if (!company?.id) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      error: "This company is already listed. Request access to post jobs under its existing profile.",
      claimRequired: true,
      companyId: company.id,
    },
    { status: 409 },
  );
}
