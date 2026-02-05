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

  const { data: files } = await supabaseAdmin
    .from("files")
    .select("id, user_id, name, mime_type, size, created_at, url")
    .order("created_at", { ascending: false });

  const header = ["id", "userId", "name", "mimeType", "size", "createdAt", "url"];
  const rows = (files || []).map((file) =>
    [
      file.id,
      file.user_id,
      file.name,
      file.mime_type,
      file.size,
      new Date(file.created_at).toISOString(),
      file.url,
    ].map(csvEscape).join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=files-export.csv",
    },
  });
}
