import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    stack: ["Notion", "Slack", "Linear", "Airtable", "Zapier"],
  });
}
