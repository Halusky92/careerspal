export const POSTING_STORAGE_KEYS = [
  "cp_draft_post",
  "cp_pending_job",
  "cp_pending_job_id",
  "cp_selected_plan",
  "cp_admin_internal_plan",
  "cp_test_plan_price",
  "cp_screen_token",
] as const;

const OWNER_KEY = "cp_posting_owner";

export function postingOwnerKey(userId?: string | null, email?: string | null) {
  if (userId) return `u:${userId}`;
  if (email) return `e:${email.trim().toLowerCase()}`;
  return "guest";
}

const scopedKey = (base: string, owner: string) => `${base}::${owner}`;

export function readPostingItem(base: string, owner: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(scopedKey(base, owner));
  } catch {
    return null;
  }
}

export function writePostingItem(base: string, owner: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(scopedKey(base, owner), value);
    sessionStorage.removeItem(base);
  } catch {
    // ignore
  }
}

export function removePostingItem(base: string, owner: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(scopedKey(base, owner));
    sessionStorage.removeItem(base);
  } catch {
    // ignore
  }
}

export function hasPendingPosting(owner: string) {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(readPostingItem("cp_pending_job", owner) || readPostingItem("cp_pending_job_id", owner));
  } catch {
    return false;
  }
}

export function clearUnscopedPostingSession() {
  if (typeof window === "undefined") return;
  try {
    POSTING_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}

type PostingStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function draftHasContent(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { formData?: Record<string, unknown> } & Record<string, unknown>;
    const form = parsed.formData && typeof parsed.formData === "object" ? parsed.formData : parsed;
    return ["title", "company", "description", "applyUrl"].some((key) => {
      const value = form[key];
      return typeof value === "string" && value.trim().length > 0;
    });
  } catch {
    return false;
  }
}

/** Keep a draft started before sign-in, and continue on the account that just signed in. */
export function claimGuestPosting(owner: string, store?: PostingStore) {
  const session = store ?? (typeof window === "undefined" ? null : window.sessionStorage);
  if (!session || !owner || owner === "guest") return;
  try {
    for (const base of POSTING_STORAGE_KEYS) {
      const guestKey = scopedKey(base, "guest");
      const guest = session.getItem(guestKey);
      if (!guest) continue;
      const ownKey = scopedKey(base, owner);
      const own = session.getItem(ownKey);
      const guestWins =
        base === "cp_draft_post" || base === "cp_pending_job"
          ? draftHasContent(guest) && !draftHasContent(own)
          : !own;
      if (guestWins || !own) session.setItem(ownKey, guest);
      session.removeItem(guestKey);
    }
  } catch {
    // ignore
  }
}

export function bindPostingSessionOwner(owner: string) {
  if (typeof window === "undefined") return;
  try {
    if (owner && owner !== "guest") claimGuestPosting(owner);
    const prev = sessionStorage.getItem(OWNER_KEY);
    if (prev && prev !== owner) {
      clearUnscopedPostingSession();
    }
    sessionStorage.setItem(OWNER_KEY, owner);
  } catch {
    // ignore
  }
}
