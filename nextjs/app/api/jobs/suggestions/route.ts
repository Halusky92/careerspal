import { NextResponse } from "next/server";
import { getBoardCatalog } from "../../../../lib/publicBoardCatalog";
import { listingsForViewer } from "../../../../lib/listingWindow";
import { publicListTierFromRequest } from "../../../../lib/boardAccessServer";
import { publicSuggestionLabels } from "../../../../lib/publicListPreview";
import { publicBoardCacheControl, requestHasCookie } from "../../../../lib/boardListQuery";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  const limitParam = Number(searchParams.get("limit") || "8");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 8;
  if (!q) return NextResponse.json({ suggestions: [] });

  const tier = await publicListTierFromRequest(request);
  const jobs = listingsForViewer(await getBoardCatalog(), tier);
  const suggestions = new Set<string>();
  for (const job of jobs) {
    if (job.title && job.title.toLowerCase().includes(q)) suggestions.add(job.title);
    if (job.company && job.company.toLowerCase().includes(q)) suggestions.add(job.company);
    for (const tag of job.tags || []) {
      if (tag.toLowerCase().includes(q)) suggestions.add(tag);
    }
  }

  return NextResponse.json(
    { suggestions: publicSuggestionLabels(Array.from(suggestions).sort((a, b) => a.localeCompare(b)), limit) },
    {
      headers: {
        "Cache-Control": publicBoardCacheControl({ tier, hasCookie: requestHasCookie(request), personalized: false }),
        Vary: "Cookie, Authorization",
      },
    },
  );
}
