import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

const hashValue = (value: string) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip;
};

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const payload = (await request.json()) as {
    path?: string;
    referrer?: string;
    sessionId?: string;
    userAgent?: string;
  };

  const ip = getClientIp(request);
  const ua = payload.userAgent || request.headers.get("user-agent") || "unknown";
  const ipHash = hashValue(`${ip}:${ua}`);

  await supabaseAdmin.from("audit_logs").insert({
    action: "page_view",
    metadata: {
      path: payload.path || "/",
      referrer: payload.referrer || "",
      sessionId: payload.sessionId || null,
      userAgent: ua,
      ipHash,
    },
  });

  return NextResponse.json({ ok: true });
}
