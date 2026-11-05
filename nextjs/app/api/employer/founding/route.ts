import { NextResponse } from "next/server";
import { getFoundingStatus, requireEmployer } from "../../../../lib/employer";

export async function GET(request: Request) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const company = (searchParams.get("company") || "").trim();
  const status = await getFoundingStatus(auth.profileId, {
    email: auth.email,
    companyName: company || null,
  });
  return NextResponse.json(status);
}
