const DEFAULT_OWNER_EMAILS = ["admin@careerspal.com", "mb.bilek@gmail.com"];

export function ownerAdminEmails() {
  const extra = (process.env.ADMIN_TEST_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_OWNER_EMAILS, ...extra])];
}

export function isOwnerAdminEmail(email?: string | null) {
  const normalized = (email || "").trim().toLowerCase();
  return Boolean(normalized && ownerAdminEmails().includes(normalized));
}
