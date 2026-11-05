import { isGuestAlertConfirmed, parseAlertPrefs } from "./alertPrefs";

/** Hide the number until it is large enough to be a real signal, not a vanity 3. */
export const PUBLIC_SUBSCRIBER_THRESHOLD = 25;

export function publicSubscriberCount(
  total: number,
  threshold = PUBLIC_SUBSCRIBER_THRESHOLD,
): number | null {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  return n >= threshold ? n : null;
}

export function uniqueConfirmedSubscriberEmails(
  subscribers: Array<{ email?: string | null; preference?: string | null }>,
  extraEmails: Array<string | null | undefined> = [],
): string[] {
  const emails = new Set<string>();
  for (const row of subscribers) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) continue;
    if (!isGuestAlertConfirmed(parseAlertPrefs(row.preference))) continue;
    emails.add(email);
  }
  for (const raw of extraEmails) {
    const email = String(raw || "").trim().toLowerCase();
    if (email) emails.add(email);
  }
  return [...emails];
}

export function formatPublicSubscriberLine(count: number | null): string | null {
  if (count == null) return null;
  return `${count} people currently get these email alerts.`;
}
