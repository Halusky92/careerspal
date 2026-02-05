import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    reviews: [
      { name: "Sarah Jenkins", role: "Notion Ops Manager", rating: 5 },
      { name: "David Chen", role: "Systems Architect", rating: 5 },
      { name: "Elena Rodriguez", role: "Head of Remote", rating: 5 },
    ],
  });
}
