import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin";

export type SupabaseProfile = {
  id: string;
  email: string;
  role: string;
  is_onboarded: boolean;
  full_name: string | null;
  avatar_url: string | null;
};

const getToken = (request: Request) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
};

export const getSupabaseUser = async (request: Request): Promise<User | null> => {
  if (!supabaseAdmin) return null;
  const token = getToken(request);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
};

export const getSupabaseProfile = async (
  request: Request,
): Promise<{ user: User; profile: SupabaseProfile } | null> => {
  if (!supabaseAdmin) return null;
  const user = await getSupabaseUser(request);
  if (!user?.email) return null;

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, is_onboarded, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (existing) {
    // Safety: ensure the canonical admin account is actually marked as admin in DB.
    // This avoids inconsistent "email fallback" checks across the app.
    const email = user.email.toLowerCase();
    const role = (existing as any)?.role;
    if (email === "admin@careerspal.com" && role !== "admin") {
      const { data: updated } = await supabaseAdmin
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", user.id)
        .select("id, email, role, is_onboarded, full_name, avatar_url")
        .single();
      if (updated) return { user, profile: updated as SupabaseProfile };
    }
    return { user, profile: existing as SupabaseProfile };
  }

  const role = user.email === "admin@careerspal.com" ? "admin" : "candidate";
  const { data: created } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      role,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      is_onboarded: false,
    })
    .select("id, email, role, is_onboarded, full_name, avatar_url")
    .single();

  if (!created) return null;
  return { user, profile: created as SupabaseProfile };
};
