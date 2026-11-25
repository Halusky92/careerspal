import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { resolveCategoryHub } from "../../../../../lib/categories";
import { buildPublicList, PUBLIC_RELATED_JOB_LIMIT } from "../../../../../lib/publicListPreview";
import { publicListTierFromRequest } from "../../../../../lib/boardAccessServer";
import { listingsForViewer } from "../../../../../lib/listingWindow";
import { getBoardCatalog } from "../../../../../lib/publicBoardCatalog";
import { publicBoardCacheControl, requestHasCookie } from "../../../../../lib/boardListQuery";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const tier = await publicListTierFromRequest(_request);
  const catalog = await getBoardCatalog();
  let current = catalog.find((job) => job.id === id);
  if (!current) {
    const { data } = await supabaseAdmin.from("jobs").select("id,title,category").eq("id", id).maybeSingle();
    if (data) current = { id: data.id, title: data.title || "", category: data.category || "" } as typeof catalog[number];
  }
  const hub = current ? resolveCategoryHub(current) : null;
  const headers = {
    "Cache-Control": publicBoardCacheControl({ tier, hasCookie: requestHasCookie(_request), personalized: false }),
    Vary: "Cookie, Authorization",
  };
  if (!hub) {
    return NextResponse.json({ jobs: [], total: 0, access: tier }, { headers });
  }
  const jobs = listingsForViewer(
    catalog.filter((job) => job.id !== id && resolveCategoryHub(job)?.slug === hub.slug),
    tier,
  );
  return NextResponse.json(buildPublicList(jobs, tier, PUBLIC_RELATED_JOB_LIMIT), { headers });
}
