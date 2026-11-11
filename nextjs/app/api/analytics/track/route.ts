import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { isLikelyBot } from "../../../../lib/trafficBots";

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
    event?: string;
    extra?: Record<string, unknown> | null;
  };

  const ip = getClientIp(request);
  const ua = payload.userAgent || request.headers.get("user-agent") || "unknown";
  if (isLikelyBot(ua)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }
  const ipHash = hashValue(`${ip}:${ua}`);

  const action = (payload.event || "page_view").trim() || "page_view";
  await supabaseAdmin.from("audit_logs").insert({
    action,
    metadata: {
      path: payload.path || "/",
      referrer: payload.referrer || "",
      sessionId: payload.sessionId || null,
      userAgent: ua,
      ipHash,
      extra: payload.extra || null,
    },
  });

  return NextResponse.json({ ok: true });
}
