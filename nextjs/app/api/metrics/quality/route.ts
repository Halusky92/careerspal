import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      spamRate: "0%",
      salaryCoverage: "100%",
      verifiedEmployers: true,
    },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" } },
  );
}
