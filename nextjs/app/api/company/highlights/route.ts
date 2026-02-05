import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    highlights: [
      "Verified hiring team",
      "Transparent compensation",
      "Async-friendly policy",
    ],
  });
}
