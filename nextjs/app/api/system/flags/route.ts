import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    showBanner: true,
    inviteOnly: true,
    aiMatch: true,
  });
}
