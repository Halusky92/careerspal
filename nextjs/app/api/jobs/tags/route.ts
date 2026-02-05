import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  const limitParam = Number(searchParams.get("limit") || "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 0;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("tags")
    .eq("status", "published");

  const tags = new Set<string>();
  (jobs || []).forEach((job) => {
    const list = (job.tags as string[]) || [];
    list.forEach((tag) => tags.add(tag));
  });

  const filtered = Array.from(tags)
    .filter((tag) => (q ? tag.toLowerCase().includes(q) : true))
    .sort((a, b) => a.localeCompare(b));
  const trimmed = limit ? filtered.slice(0, limit) : filtered;
  return NextResponse.json(
    { tags: trimmed },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
