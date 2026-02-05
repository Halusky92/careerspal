import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ status: "error" }, { status: 500 });
    }
    await supabaseAdmin.from("jobs").select("id").limit(1);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
