import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    sla: "7 days",
    salaryCoverage: "100%",
    inviteOnly: true,
  });
}
