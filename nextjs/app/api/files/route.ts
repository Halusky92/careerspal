import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) return NextResponse.json({ files: [] });

  const { data } = await supabaseAdmin
    .from("files")
    .select("id,name,size,mime_type,url,created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });
  const files = (data || []).map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    mimeType: file.mime_type,
    url: file.url,
    createdAt: file.created_at,
  }));
  return NextResponse.json({ files });
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    size?: number;
    mimeType?: string;
    url?: string;
  };

  if (!body.name || !body.mimeType || !body.url || !body.size) {
    return NextResponse.json({ error: "Missing file metadata." }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("files")
    .insert({
      user_id: profileId,
      name: body.name,
      size: body.size,
      mime_type: body.mimeType,
      url: body.url,
    })
    .select("id,name,size,mime_type,url,created_at")
    .single();
  const file = data
    ? {
        id: data.id,
        name: data.name,
        size: data.size,
        mimeType: data.mime_type,
        url: data.url,
        createdAt: data.created_at,
      }
    : null;
  return NextResponse.json({ file }, { status: 201 });
}
