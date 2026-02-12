import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    privacy: "/privacy",
    terms: "/terms",
    operator: {
      name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "Mgr. Marek Bilek",
      address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || null,
      companyId: process.env.NEXT_PUBLIC_OPERATOR_COMPANY_ID || null,
      vatId: process.env.NEXT_PUBLIC_OPERATOR_VAT_ID || null,
      contactEmail: "info@careerspal.com",
    },
  });
}
