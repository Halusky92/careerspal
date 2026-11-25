import { NextResponse } from "next/server";
import { getCategoryHub, jobMatchesHub } from "../../../../../lib/categories";
import { publicListTierFromRequest } from "../../../../../lib/boardAccessServer";
import { listingsForViewer } from "../../../../../lib/listingWindow";
import { buildPublicList } from "../../../../../lib/publicListPreview";
import { getBoardCatalog } from "../../../../../lib/publicBoardCatalog";
import { publicBoardCacheControl, requestHasCookie } from "../../../../../lib/boardListQuery";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const hub = getCategoryHub(slug);
  if (!hub) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  const tier = await publicListTierFromRequest(request);
  let catalog;
  try {
    catalog = await getBoardCatalog();
  } catch {
    return NextResponse.json({ error: "Category is unavailable." }, { status: 500 });
  }
  const jobs = listingsForViewer(
    catalog.filter((job) => jobMatchesHub(job, hub)),
    tier,
  );
  return NextResponse.json(buildPublicList(jobs, tier, jobs.length), {
    headers: {
      "Cache-Control": publicBoardCacheControl({ tier, hasCookie: requestHasCookie(request), personalized: false }),
      Vary: "Cookie, Authorization",
    },
  });
};
