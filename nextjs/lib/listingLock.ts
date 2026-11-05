export const LISTING_CONTENT_EDITABLE = new Set(["draft", "pending_review"]);

export const LISTING_LOCKED_MESSAGE =
  "This listing is already on the board. Post a new job under the same company instead of changing this one.";

export const COMPANY_OWNED_ELSEWHERE_MESSAGE =
  "This company profile is already on the board. Post new jobs under your own company, or use the account that posted it.";

export function employerCanEditListingContent(status?: string | null) {
  return LISTING_CONTENT_EDITABLE.has(String(status || "draft"));
}

const LISTING_CONTENT_KEYS = [
  "title",
  "description",
  "location",
  "remotePolicy",
  "type",
  "salary",
  "applyUrl",
  "company",
  "companyWebsite",
  "keywords",
  "tools",
  "tags",
] as const;

export function patchHasListingContent(body: Record<string, unknown>) {
  return LISTING_CONTENT_KEYS.some((key) => body[key] !== undefined);
}
