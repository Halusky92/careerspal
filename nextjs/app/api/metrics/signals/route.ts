import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    sla: "2 days",
    salaryCoverage: "100%",
    inviteOnly: true,
  });
}
