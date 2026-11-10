import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { automationRunView } from "../../../../../../lib/sourcing/automationRunView";

export const runtime = "nodejs";

const toInt = (value: string | null, fallback: number) => {
  const n = Number.parseInt((value || "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
};

type AutomationRunRow = {
  id: string;
  actor_id: string | null;
  action: string;
  metadata: any;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Math.min(60, Math.max(1, toInt(url.searchParams.get("limit"), 14)));

  const { data: logs, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id,actor_id,action,metadata,created_at")
    .eq("action", "sourcing_greenhouse_pipeline_run")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Unable to load automation runs." }, { status: 500 });
  }

  const { data: healthRows } = await supabaseAdmin
    .from("audit_logs")
    .select("id,metadata,created_at")
    .eq("action", "sourcing_cron_health")
    .order("created_at", { ascending: false })
    .limit(20);

  const healthList = (healthRows || []) as { metadata: any; created_at: string }[];
  const lastHealth = healthList[0] || null;
  const lastOk = healthList.find((row) => {
    const status = String(row.metadata?.status || "");
    return status === "ok" || status === "partial";
  });
  const ageMs = lastOk ? Date.now() - new Date(lastOk.created_at).getTime() : null;
  const cronHealth = {
    lastStatus: lastHealth?.metadata?.status || "missing",
    lastAt: lastHealth?.created_at || null,
    lastOkAt: lastOk?.created_at || null,
    lastError: lastHealth?.metadata?.error || null,
    secretConfigured: Boolean((process.env.SOURCING_CRON_SECRET || "").trim()),
    overdue: !ageMs || ageMs > 26 * 60 * 60 * 1000,
  };

  // Normalize a small, UI-friendly shape (avoid coupling UI to raw metadata).
  const runs = ((logs as AutomationRunRow[] | null) || []).map((row) =>
    automationRunView({
      id: row.id,
      actor_id: row.actor_id,
      metadata: row.metadata,
      created_at: row.created_at,
    }),
  );

  return NextResponse.json({ runs, cronHealth });
}

