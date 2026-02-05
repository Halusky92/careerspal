import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Private roles are live. Apply with confidence.",
    tone: "info",
  });
}
