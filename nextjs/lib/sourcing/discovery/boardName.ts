export function companyNameFromBoardTitle(title: string | null | undefined): string {
  const cleaned = (title || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const jobsAt = cleaned.match(/^jobs at\s+(.+)$/i);
  if (jobsAt) return jobsAt[1].replace(/\s+jobs$/i, "").trim();
  const suffix = cleaned.match(/^(.*?)\s+jobs$/i);
  if (suffix) return suffix[1].trim();
  if (/[|]/.test(cleaned) || /careers|open roles/i.test(cleaned)) return "";
  return cleaned;
}

/** A lowercase board token is not a public company name. Mixed-case brands stay. */
export function isRawAtsSlug(name: string | null | undefined, identifier?: string | null): boolean {
  const value = (name || "").trim();
  if (!value) return true;
  const token = (identifier || "").trim().toLowerCase();
  if (token && value.toLowerCase() === token && value === value.toLowerCase()) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
