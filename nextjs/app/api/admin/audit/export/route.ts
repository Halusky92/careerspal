import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data: logs } = await supabaseAdmin
    .from("audit_logs")
    .select("id, action, job_id, actor_id, created_at")
    .order("created_at", { ascending: false });

  const header = ["id", "action", "jobId", "actorId", "createdAt"];
  const rows = (logs || []).map((log) =>
    [
      log.id,
      log.action,
      log.job_id,
      log.actor_id,
      new Date(log.created_at).toISOString(),
    ].map(csvEscape).join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=audit-export.csv",
    },
  });
}
