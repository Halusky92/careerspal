import { NextResponse } from "next/server";
import { loadPublicCompanyBySlug } from "../../../../lib/publicCompany";
import { isOnNicheJob } from "../../../../lib/nicheScope";
import { publicListTierFromRequest } from "../../../../lib/boardAccessServer";
import { listingsForViewer } from "../../../../lib/listingWindow";
import { buildPublicList, listCacheHeaders } from "../../../../lib/publicListPreview";

export const dynamic = "force-dynamic";

export const GET = async (request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const result = await loadPublicCompanyBySlug(slug);
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (result.kind === "error") {
    return NextResponse.json({ error: "Company is unavailable." }, { status: 500 });
  }
  const tier = await publicListTierFromRequest(request);
  const listed = listingsForViewer(result.jobs.filter((job) => isOnNicheJob(job)), tier);
  const list = buildPublicList(listed, tier, listed.length);
  return NextResponse.json({ company: result.company, ...list }, { headers: listCacheHeaders() });
};
