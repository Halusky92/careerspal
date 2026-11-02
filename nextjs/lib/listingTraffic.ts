export const LISTING_SOURCES = [
  "board",
  "job_page",
  "company",
  "home",
  "alerts",
  "google",
  "external",
  "direct",
] as const;

export type ListingSource = (typeof LISTING_SOURCES)[number] | string;

export const listingSourceLabel = (source: string) => {
  switch (source) {
    case "board":
      return "Job board";
    case "job_page":
      return "Role page";
    case "company":
      return "Company page";
    case "home":
      return "Homepage";
    case "alerts":
      return "Email alert";
    case "google":
      return "Google";
    case "external":
      return "External";
    case "direct":
      return "Direct";
    default:
      return source;
  }
};

export const classifyListingSource = (input: {
  path?: string | null;
  referrer?: string | null;
  utm?: string | null;
}): ListingSource => {
  const utm = (input.utm || "").trim().toLowerCase();
  if (utm) {
    if (utm.includes("alert") || utm === "email") return "alerts";
    if (utm.includes("google")) return "google";
    return utm.slice(0, 32);
  }

  const path = (input.path || "").split("?")[0];
  if (path === "/jobs") return "board";
  if (path.startsWith("/companies")) return "company";
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/alerts")) return "alerts";

  const referrer = input.referrer || "";
  if (!referrer) return path.startsWith("/jobs/") ? "direct" : "direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("google.")) return "google";
    if (host.includes("careerspal.com") || host.includes("localhost")) {
      return classifyListingSource({ path: url.pathname, referrer: "", utm: url.searchParams.get("utm_source") });
    }
    return "external";
  } catch {
    return "external";
  }
};
