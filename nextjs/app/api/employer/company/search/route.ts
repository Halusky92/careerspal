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

  let { data, error } = await supabaseAdmin!
    .from("companies")
    .select("id,name,slug,website,claimed_by,created_by,logo_url")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(8);
  if (error) {
    const fallback = await supabaseAdmin!
      .from("companies")
      .select("id,name,slug,website,created_by,logo_url")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(8);
    data = fallback.data as typeof data;
  }

  const companies = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    website: row.website,
    logoUrl: row.logo_url,
    claimed: false,
    owned: row.created_by === auth.profileId,
  }));

  return NextResponse.json({ companies });
}
