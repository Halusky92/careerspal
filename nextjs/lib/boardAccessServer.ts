import { getSupabaseProfile } from "./supabaseServerAuth";
import { supabaseAdmin } from "./supabaseAdmin";
import { boardCapsEnabled, tierForPublicList, type BoardTier } from "./boardAccess";

async function viewerTierFromRequest(request: Request): Promise<BoardTier> {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) return "guest";
  if (!supabaseAdmin) {
    return tierForPublicList({ signedIn: true, role: auth.profile.role });
  }
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
  return tierForPublicList({
    signedIn: true,
    role: auth.profile.role,
    premiumUntil,
    subscriptionStatus: status,
  });
}

export async function boardTierFromRequest(request: Request): Promise<BoardTier> {
  if (!boardCapsEnabled()) return "paid";
  return viewerTierFromRequest(request);
}

/** Always checks the session. The board caps switch does not open these lists. */
export async function publicListTierFromRequest(request: Request): Promise<BoardTier> {
  return viewerTierFromRequest(request);
}
