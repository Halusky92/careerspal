import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    standard: 79,
    featured: 149,
    elite: 249,
  });
}
