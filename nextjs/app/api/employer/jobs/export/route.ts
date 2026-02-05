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
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id,title,status,views,matches,created_at")
    .eq("created_by", profileId)
    .order("created_at", { ascending: false });

  const header = ["id", "title", "status", "views", "matches", "createdAt"];
  const rows = (jobs || []).map((job) =>
    [
      job.id,
      job.title,
      job.status,
      job.views,
      job.matches,
      new Date(job.created_at).toISOString(),
    ].map(csvEscape).join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=my-jobs-export.csv",
    },
  });
}
