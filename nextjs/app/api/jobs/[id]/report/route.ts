import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { checkRateLimit } from "../../../../../lib/rateLimit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = checkRateLimit(`report:${ip}`, { windowMs: 60_000, max: 10 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { reason?: string };
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: job } = await supabaseAdmin.from("jobs").select("id").eq("id", id).single();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "report",
    job_id: id,
    metadata: { reason: body.reason || "unspecified" },
  });

  return NextResponse.json({ success: true });
}
