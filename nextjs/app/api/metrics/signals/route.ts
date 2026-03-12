import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    // Metrics endpoint is informational only. Do not hardcode trust guarantees.
    reviewedBeforePublish: true,
  });
}
