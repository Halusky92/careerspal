import { supabaseAdmin } from "./supabaseAdmin";
import { publicSubscriberCount, uniqueConfirmedSubscriberEmails } from "./publicSubscriberCount";

export async function countConfirmedAlertRecipients(): Promise<number> {
  if (!supabaseAdmin) return 0;

  const [{ data: subscribers }, { data: alerts }] = await Promise.all([
    supabaseAdmin.from("subscribers").select("email,preference"),
    supabaseAdmin.from("alerts").select("user_id"),
  ]);

  const userIds = [...new Set((alerts || []).map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
    : { data: [] };

  return uniqueConfirmedSubscriberEmails(
    subscribers || [],
    (profiles || []).map((row) => row.email),
  ).length;
}

export async function getPublicSubscriberCount(): Promise<number | null> {
  const total = await countConfirmedAlertRecipients();
  return publicSubscriberCount(total);
}
