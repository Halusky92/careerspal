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

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id,title,location,type,salary,status,created_at,companies(name)")
    .order("created_at", { ascending: false });

  const header = [
    "id",
    "title",
    "company",
    "location",
    "type",
    "salary",
    "status",
    "createdAt",
  ];

  const rows = (jobs || []).map((job) =>
    [
      job.id,
      job.title,
      job.companies?.name,
      job.location,
      job.type,
      job.salary,
      job.status,
      new Date(job.created_at).toISOString(),
    ].map(csvEscape).join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=jobs-export.csv",
    },
  });
}
