import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireEmployer } from "../../../../../lib/employer";

export async function GET(request: Request) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ companies: [] });
  }

  const { data } = await supabaseAdmin!
    .from("companies")
    .select("id,name,slug,website,claimed_by,logo_url")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(8);

  const companies = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    website: row.website,
    logoUrl: row.logo_url,
    claimed: Boolean(row.claimed_by),
    owned: row.claimed_by === auth.profileId,
  }));

  return NextResponse.json({ companies });
}
