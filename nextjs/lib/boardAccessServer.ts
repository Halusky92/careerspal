import { getSupabaseProfile } from "./supabaseServerAuth";
import { supabaseAdmin } from "./supabaseAdmin";
import { boardCapsEnabled, resolveBoardTier, type BoardTier } from "./boardAccess";

export async function boardTierFromRequest(request: Request): Promise<BoardTier> {
  if (!boardCapsEnabled()) return "paid";
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) return "guest";
  if (auth.profile.role === "admin") return "paid";
  if (!supabaseAdmin) return "registered";
  const first = await supabaseAdmin
    .from("profiles")
    .select("board_premium_until,stripe_subscription_status")
    .eq("id", auth.profile.id)
    .maybeSingle();
  const row = first.error
    ? (
        await supabaseAdmin
          .from("profiles")
          .select("board_premium_until")
          .eq("id", auth.profile.id)
          .maybeSingle()
      ).data
    : first.data;
  const status = (row as { stripe_subscription_status?: string | null } | null)?.stripe_subscription_status;
  const premiumUntil = (row as { board_premium_until?: string | null } | null)?.board_premium_until;
  const fromUntil = resolveBoardTier({
    signedIn: true,
    role: auth.profile.role,
    premiumUntil,
  });
  if (fromUntil === "paid") return "paid";
  if ((status === "active" || status === "trialing") && !premiumUntil) return "paid";
  return fromUntil;
}
