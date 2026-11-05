const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "fastmail.com",
]);

export function emailDomain(email?: string | null) {
  const at = (email || "").trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return "";
  return (email || "").trim().toLowerCase().slice(at + 1).replace(/^www\./, "");
}

export function workEmailDomain(email?: string | null) {
  const domain = emailDomain(email);
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return "";
  return domain;
}

export function hostnameDomain(url?: string | null) {
  const raw = (url || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] || "";
  }
}

export function normalizeCompanyKey(name?: string | null) {
  return (name || "")
    .toLowerCase()
    .replace(/\b(incorporated|limited|company|corp|gmbh|llc|ltd|inc|co)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
