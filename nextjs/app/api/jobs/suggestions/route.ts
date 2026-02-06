import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type SuggestionJobRow = {
  title: string | null;
  tags: unknown;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  const limitParam = Number(searchParams.get("limit") || "8");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 8;
  if (!q) return NextResponse.json({ suggestions: [] });
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("title,tags,companies(name)")
    .eq("status", "published")
    .limit(50);

  const suggestions = new Set<string>();
  (jobs as SuggestionJobRow[] | null || []).forEach((job) => {
    const companyName = Array.isArray(job.companies) ? job.companies[0]?.name : job.companies?.name;
    if (job.title && job.title.toLowerCase().includes(q)) suggestions.add(job.title);
    if (companyName && companyName.toLowerCase().includes(q)) {
      suggestions.add(companyName);
    }
    const tags = (job.tags as string[]) || [];
    tags.forEach((tag) => {
      if (tag.toLowerCase().includes(q)) suggestions.add(tag);
    });
  });

  return NextResponse.json(
    { suggestions: Array.from(suggestions).sort((a, b) => a.localeCompare(b)).slice(0, limit) },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
