import { NextResponse } from "next/server";
import { loadPublicCompanyBySlug } from "../../../../lib/publicCompany";

export const GET = async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const result = await loadPublicCompanyBySlug(slug);
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (result.kind === "error") {
    return NextResponse.json({ error: "Company is unavailable." }, { status: 500 });
  }
  return NextResponse.json({ company: result.company, jobs: result.jobs });
};
