import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      weeklyVisitors: 18400,
      weeklyApplications: 920,
    },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" } },
  );
}
