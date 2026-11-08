import { alertPrefsLabel, isGuestAlertConfirmed, parseAlertPrefs } from "./alertPrefs";

export type AdminAlertRow = {
  email: string;
  source: "guest" | "account";
  confirmed: boolean;
  label: string;
  joinedAt: string | null;
};

const norm = (email?: string | null) => (email || "").trim().toLowerCase();

export function guestAlertRows(
  subscribers: Array<{ email?: string | null; preference?: string | null; created_at?: string | null }>,
): AdminAlertRow[] {
  const rows: AdminAlertRow[] = [];
  for (const row of subscribers) {
    const email = norm(row.email);
    if (!email) continue;
    const prefs = parseAlertPrefs(row.preference);
    rows.push({
      email,
      source: "guest",
      confirmed: isGuestAlertConfirmed(prefs),
      label: alertPrefsLabel(prefs),
      joinedAt: row.created_at || null,
    });
  }
  return rows;
}

export function accountAlertRows(
  alerts: Array<{ user_id?: string | null; query?: string | null; location?: string | null; created_at?: string | null }>,
  profiles: Array<{ id?: string | null; email?: string | null }>,
): AdminAlertRow[] {
  const emailById = new Map<string, string>();
  for (const row of profiles) {
    const id = row.id || "";
    const email = norm(row.email);
    if (id && email) emailById.set(id, email);
  }
  const rows: AdminAlertRow[] = [];
  for (const row of alerts) {
    const email = emailById.get(row.user_id || "") || "";
    if (!email) continue;
    const query = (row.query || "").trim() || "saved alert";
    const location = (row.location || "").trim();
    rows.push({
      email,
      source: "account",
      confirmed: true,
      label: location ? `${query} · ${location}` : query,
      joinedAt: row.created_at || null,
    });
  }
  return rows;
}
