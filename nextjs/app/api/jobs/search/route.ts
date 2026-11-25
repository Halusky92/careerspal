import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { publicListTierFromRequest } from "../../../../lib/boardAccessServer";
import { listingsForViewer } from "../../../../lib/listingWindow";
import { getBoardCatalog } from "../../../../lib/publicBoardCatalog";
import { applyStoredBoardFilters } from "../../../../lib/publicJobBoard";
import {
  filterAndSortBoard,
  filtersFromSearchParams,
  pageBoard,
  publicBoardCacheControl,
  requestHasCookie,
} from "../../../../lib/boardListQuery";

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "0");
  const skipParam = Number(searchParams.get("skip") || "0");
  const tier = await publicListTierFromRequest(request);
  const filters = filtersFromSearchParams(searchParams);
  if (!filters.query && searchParams.get("q")) filters.query = searchParams.get("q") || "";
  const catalog = listingsForViewer(
    applyStoredBoardFilters(await getBoardCatalog(), {
      category: searchParams.get("category"),
      type: searchParams.get("type"),
      planType: searchParams.get("planType"),
      remote: searchParams.get("remote"),
    }),
    tier,
  );
  const filtered = filterAndSortBoard(catalog, filters);
  const page = pageBoard(filtered, skipParam, limitParam);
  return NextResponse.json(
    { jobs: page.jobs, total: page.total, visible: page.visible, access: tier },
    {
      headers: {
        "Cache-Control": publicBoardCacheControl({ tier, hasCookie: requestHasCookie(request), personalized: filters.saved }),
        Vary: "Cookie, Authorization",
      },
    },
  );
}
