/**
 * CareersPal category hubs. Title is the source of truth; DB category is a fallback.
 */

export type CategorySlug =
  | "operations"
  | "systems"
  | "automation"
  | "revops"
  | "product-ops"
  | "chief-of-staff";

export type CategoryHub = {
  slug: CategorySlug;
  label: string;
  dbCategories: string[];
  titlePatterns: RegExp[];
  intro: string;
};

export const CATEGORY_HUBS: CategoryHub[] = [
  {
    slug: "operations",
    label: "Operations",
    dbCategories: ["Operations"],
    titlePatterns: [
      /\boperations\b/i,
      /\bbizops\b/i,
      /\bbiz ops\b/i,
      /\bbusiness operations\b/i,
      /\bstrategy (and|&) operations\b/i,
    ],
    intro: "Business operations, process, and operational leadership.",
  },
  {
    slug: "systems",
    label: "Systems",
    dbCategories: ["Systems Design"],
    titlePatterns: [/\bbusiness systems\b/i, /\bsystems analyst\b/i, /\bsystems architect\b/i],
    intro: "Business systems, workflows, and internal operating systems.",
  },
  {
    slug: "automation",
    label: "Automation",
    dbCategories: ["Automation"],
    titlePatterns: [/\bworkflow automation\b/i, /\bautomation (engineer|specialist|manager|lead|ops)\b/i, /\binternal tools\b/i],
    intro: "Automation, integrations, and internal tools.",
  },
  {
    slug: "revops",
    label: "RevOps",
    dbCategories: ["Marketing & Growth Ops"],
    titlePatterns: [
      /\brevops\b/i,
      /\brevenue operations\b/i,
      /\bsales operations\b/i,
      /\bsales ops\b/i,
      /\bmarketing operations\b/i,
      /\bmarketing ops\b/i,
      /\bgtm operations\b/i,
      /\bgtm ops\b/i,
      /\bgo-to-market operations\b/i,
      /\bcustomer operations\b/i,
      /\bcustomer success operations\b/i,
      /\bcs ops\b/i,
      /\bdeal desk\b/i,
    ],
    intro: "Revenue, sales, marketing, and GTM operations.",
  },
  {
    slug: "product-ops",
    label: "Product Ops",
    dbCategories: ["Product Management"],
    titlePatterns: [/\bproduct ops\b/i, /\bproduct operations\b/i],
    intro: "Product operations and product workflow roles.",
  },
  {
    slug: "chief-of-staff",
    label: "Chief of Staff",
    dbCategories: ["Executive & Staff"],
    titlePatterns: [/\bchief of staff\b/i],
    intro: "Chief of Staff and office-of-the-CEO execution roles.",
  },
];

const HUB_MATCH_ORDER: CategorySlug[] = [
  "revops",
  "product-ops",
  "chief-of-staff",
  "automation",
  "systems",
  "operations",
];

export const CATEGORY_SLUGS: CategorySlug[] = CATEGORY_HUBS.map((c) => c.slug);

export const getCategoryHub = (slug: string): CategoryHub | null =>
  CATEGORY_HUBS.find((c) => c.slug === slug) || null;

export const getCategoryHubForDbCategory = (dbCategory: string): CategoryHub | null => {
  const needle = (dbCategory || "").trim();
  if (!needle) return null;
  return CATEGORY_HUBS.find((hub) => hub.dbCategories.some((c) => c.trim() === needle)) || null;
};

const titleHitsHub = (title: string, hub: CategoryHub) => hub.titlePatterns.some((re) => re.test(title));

export function resolveCategoryHub(job: { title?: string | null; category?: string | null }): CategoryHub | null {
  const title = (job.title || "").trim();
  for (const slug of HUB_MATCH_ORDER) {
    const hub = getCategoryHub(slug);
    if (hub && title && titleHitsHub(title, hub)) return hub;
  }
  return getCategoryHubForDbCategory(job.category || "");
}

export function jobMatchesHub(job: { title?: string | null; category?: string | null }, hub: CategoryHub): boolean {
  return resolveCategoryHub(job)?.slug === hub.slug;
}

export function resolveCategoryParam(raw?: string | null): string {
  const value = (raw || "").trim();
  if (!value || value === "All Roles") return "All Roles";
  const bySlug = getCategoryHub(value);
  if (bySlug) return bySlug.slug;
  const byDb = getCategoryHubForDbCategory(value);
  if (byDb) return byDb.slug;
  return "All Roles";
}

export function jobMatchesAlertQuery(job: { title?: string | null; category?: string | null }, query: string): boolean {
  const raw = (query || "").trim();
  if (!raw || raw.toLowerCase() === "all") return true;
  const hub = getCategoryHub(raw) || getCategoryHubForDbCategory(raw);
  if (hub) return jobMatchesHub(job, hub);
  const needle = raw.toLowerCase();
  const hay = `${job.title || ""} ${job.category || ""}`.toLowerCase();
  return hay.includes(needle);
}
