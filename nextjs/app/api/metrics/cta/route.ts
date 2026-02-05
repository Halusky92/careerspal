import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    headline: "Your next ops lead is already here.",
    action: "Browse roles",
  });
}
