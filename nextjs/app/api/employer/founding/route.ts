import { NextResponse } from "next/server";
import { getFoundingStatus, requireEmployer } from "../../../../lib/employer";

export async function GET(request: Request) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const status = await getFoundingStatus(auth.profileId);
  return NextResponse.json(status);
}
