import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    reviews: [
      { name: "Ops Lead", role: "EU • Systems & Operations", note: "Early member feedback" },
      { name: "Automation Specialist", role: "Remote • No-code / Ops", note: "Early member feedback" },
      { name: "Hiring Manager", role: "B2B • Operations", note: "Early member feedback" },
    ],
  });
}
