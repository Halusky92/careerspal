import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    insight: "Roles with salary ranges receive 2.3x more qualified applicants.",
  });
}
