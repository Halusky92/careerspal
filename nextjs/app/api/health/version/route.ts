import { NextResponse } from "next/server";

export async function GET() {
  const version = process.env.npm_package_version || "0.1.0";
  return NextResponse.json({ version });
}
