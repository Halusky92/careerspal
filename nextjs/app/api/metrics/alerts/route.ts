import { NextResponse } from "next/server";
import { getPublicSubscriberCount } from "../../../../lib/countAlertSubscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const subscribers = await getPublicSubscriberCount();
  return NextResponse.json({ subscribers });
}
