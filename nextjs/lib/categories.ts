/**
 * CareersPal category hubs (SEO / navigation).
 *
 * IMPORTANT:
 * - `dbCategories` maps a URL category slug to the current DB taxonomy (`jobs.category`).
 * - Some mappings are TEMPORARY fallbacks until the DB taxonomy is aligned with the niche IA.
 *   Do NOT spread ad-hoc mapping logic across pages. Use this file as the single source of truth.
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
  /**
   * Categories in Supabase `jobs.category` that should appear under this hub.
   *
   * NOTE: `revops` and `product-ops` are TEMPORARY fallbacks (DB taxonomy too broad).
   */
  dbCategories: string[];
  intro: string;
  temporaryMappingNote?: string;
};

export const CATEGORY_HUBS: CategoryHub[] = [
  {
    slug: "operations",
    label: "Operations",
    dbCategories: ["Operations"],
    intro: "Operations roles focused on running the business: execution, processes, and operational clarity.",
  },
  {
    slug: "systems",
    label: "Systems",
    dbCategories: ["Systems Design"],
    intro: "Systems roles focused on operating systems, workflows, and scalable internal tooling.",
  },
  {
    slug: "automation",
    label: "Automation",
    dbCategories: ["Automation"],
    intro: "Automation roles focused on integrations, workflows, and reducing manual work across teams.",
  },
  {
    slug: "revops",
    label: "RevOps",
    // TEMP fallback until DB taxonomy includes a dedicated RevOps category.
    dbCategories: ["Marketing & Growth Ops"],
    intro: "Revenue operations roles focused on funnel operations, CRM hygiene, and growth systems.",
    temporaryMappingNote:
      "TEMP: `revops` currently maps to DB category `Marketing & Growth Ops` until RevOps is its own DB category.",
  },
  {
    slug: "product-ops",
    label: "Product Ops",
    // TEMP fallback until DB taxonomy includes a dedicated Product Ops category.
    dbCategories: ["Product Management"],
    intro: "Product operations roles focused on product workflows, cross-functional execution, and operational rigor.",
    temporaryMappingNote:
      "TEMP: `product-ops` currently maps to DB category `Product Management` until Product Ops is its own DB category.",
  },
  {
    slug: "chief-of-staff",
    label: "Chief of Staff",
    dbCategories: ["Executive & Staff"],
    intro: "Chief of Staff roles focused on strategic execution, operating cadence, and leadership support.",
  },
];

export const CATEGORY_SLUGS: CategorySlug[] = CATEGORY_HUBS.map((c) => c.slug);

export const getCategoryHub = (slug: string): CategoryHub | null =>
  (CATEGORY_HUBS.find((c) => c.slug === slug) as CategoryHub | undefined) || null;

export const getCategoryHubForDbCategory = (dbCategory: string): CategoryHub | null => {
  const needle = (dbCategory || "").trim();
  if (!needle) return null;
  return (
    CATEGORY_HUBS.find((hub) => hub.dbCategories.some((c) => c.trim() === needle)) ||
    null
  );
};

