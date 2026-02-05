import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ email: "support@careerspal.com" });
}
