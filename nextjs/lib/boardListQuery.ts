import type { Job } from "../types";
import type { BoardTier } from "./boardAccess";
import { PAID_JOBS_PAGE_MAX } from "./boardAccess";
import { categoryCountsForJobs, getCategoryHub, jobMatchesHub, resolveCategoryParam } from "./categories";
import { KNOWN_TOOL_LABELS } from "./postingTools";
import { isPriorityListing } from "./listingWindow";
import { jobMatchesLocationQuery, locationLabelsForJobs, workModeFromPlaceLabel } from "./locationFilter";
import { isOnNicheJob } from "./nicheScope";
import { rolePreviewBullets } from "./sourcing/normalization/description";
import { inferWorkMode, publicLocationLabel } from "./workMode";

export const BOARD_PAGE_SIZE = PAID_JOBS_PAGE_MAX;
export const BOARD_INDEX_REVALIDATE_SECONDS = 300;
export const BOARD_CDN_SECONDS = 15;
export const SAVED_FILTER_MAX = 2000;

export type BoardListFilters = {
  query: string;
  location: string;
  category: string;
  workMode: "All" | "Remote" | "Hybrid";
  type: string;
  sort: "newest" | "salary" | "relevant";
  salaryMin: number;
  salaryMax: number;
  tools: string[];
  tz: "any" | "eu" | "us";
  seniority: "any" | "junior" | "mid" | "senior" | "lead";
  verified: boolean;
  saved: boolean;
  savedIds: string[];
};

export const EMPTY_BOARD_FILTERS: BoardListFilters = {
  query: "",
  location: "",
  category: "All Roles",
  workMode: "All",
  type: "All",
  sort: "relevant",
  salaryMin: 0,
  salaryMax: 0,
  tools: [],
  tz: "any",
  seniority: "any",
  verified: false,
  saved: false,
  savedIds: [],
};

const read = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export function filtersFromSearchParams(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): BoardListFilters {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) return params.get(key) || "";
    return read(params[key]);
  };
  const locationRaw = get("location");
  const moved = workModeFromPlaceLabel(locationRaw);
  const workRaw = get("workMode");
  const workMode =
    workRaw === "Remote" || workRaw === "Hybrid"
      ? workRaw
      : moved === "Remote" || moved === "Hybrid"
        ? moved
        : "All";
  const sortRaw = get("sort");
  const tzRaw = get("tz");
  const seniorityRaw = get("seniority");
  const salaryMin = Number(get("salaryMin"));
  const salaryMax = Number(get("salaryMax"));
  const savedIds = get("savedIds")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 80)
    .slice(0, SAVED_FILTER_MAX);
  return {
    query: get("query") || get("q"),
    location: moved ? "" : locationRaw,
    category: resolveCategoryParam(get("category")),
    workMode,
    type: get("type") || "All",
    sort: sortRaw === "newest" || sortRaw === "salary" || sortRaw === "relevant" ? sortRaw : "relevant",
    salaryMin: Number.isFinite(salaryMin) && salaryMin > 0 ? salaryMin : 0,
    salaryMax: Number.isFinite(salaryMax) && salaryMax > 0 ? salaryMax : 0,
    tools: get("tools")
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean)
      .slice(0, 8),
    tz: tzRaw === "eu" || tzRaw === "us" ? tzRaw : "any",
    seniority:
      seniorityRaw === "junior" || seniorityRaw === "mid" || seniorityRaw === "senior" || seniorityRaw === "lead"
        ? seniorityRaw
        : "any",
    verified: get("verified") === "1",
    saved: get("saved") === "1",
    savedIds,
  };
}

export function boardFilterKey(filters: BoardListFilters): string {
  return JSON.stringify({
    ...filters,
    query: filters.query.trim(),
    location: filters.location.trim(),
    tools: [...filters.tools].sort(),
    savedIds: filters.saved ? [...filters.savedIds].sort() : [],
  });
}

export function boardQueryString(filters: BoardListFilters, skip = 0, limit = BOARD_PAGE_SIZE): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (skip > 0) params.set("skip", String(skip));
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.location.trim()) params.set("location", filters.location.trim());
  if (filters.category && filters.category !== "All Roles") params.set("category", filters.category);
  if (filters.workMode !== "All") params.set("workMode", filters.workMode);
  if (filters.type && filters.type !== "All") params.set("type", filters.type);
  if (filters.sort && filters.sort !== "relevant") params.set("sort", filters.sort);
  if (filters.salaryMin > 0) params.set("salaryMin", String(filters.salaryMin));
  if (filters.salaryMax > 0) params.set("salaryMax", String(filters.salaryMax));
  if (filters.tools.length) params.set("tools", filters.tools.join(","));
  if (filters.tz !== "any") params.set("tz", filters.tz);
  if (filters.seniority !== "any") params.set("seniority", filters.seniority);
  if (filters.verified) params.set("verified", "1");
  if (filters.saved) {
    params.set("saved", "1");
    if (filters.savedIds.length) params.set("savedIds", filters.savedIds.join(","));
  }
  return params.toString();
}

export function parseSalaryRange(salary: string) {
  if (/\b(?:sgd|hkd|inr|eur|gbp|cad|aud|nzd|chf|jpy|sek|nok|dkk|pln|czk)\b|€|£|ca\$|a\$/i.test(salary) && !/\busd\b|us\$/i.test(salary)) {
    return { min: 0, max: 0 };
  }
  const normalized = salary.toLowerCase().replace(/,/g, "");
  const isHourly = normalized.includes("/hr") || normalized.includes("per hour") || normalized.includes("hour");
  const matches = [...normalized.matchAll(/\$?\s?(\d+(?:\.\d+)?)(k)?/g)];
  const values = matches
    .map((match) => {
      const raw = parseFloat(match[1]);
      if (Number.isNaN(raw)) return null;
      const isThousands = Boolean(match[2]) || normalized.includes("k");
      return isThousands ? raw * 1000 : raw;
    })
    .filter((value): value is number => value !== null);
  if (values.length === 0) return { min: 0, max: 0 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (isHourly) {
    min *= 2080;
    max *= 2080;
  }
  return { min, max };
}

const inferSeniority = (job: Job): "junior" | "mid" | "senior" | "lead" | "unknown" => {
  const t = (job.title || "").toLowerCase();
  if (t.includes("intern") || t.includes("junior") || t.includes("jr")) return "junior";
  if (t.includes("principal") || t.includes("head") || t.includes("director") || t.includes("vp ")) return "lead";
  if (t.includes("lead") || t.includes("staff")) return "lead";
  if (t.includes("senior") || t.includes("sr")) return "senior";
  if (t.includes("mid")) return "mid";
  return "unknown";
};

const inferTimezoneBucket = (job: Job): "eu" | "us" | "unknown" => {
  if (job.boardTz === "eu" || job.boardTz === "us") return job.boardTz;
  const text = `${job.location || ""} ${job.remotePolicy || ""} ${(job.description || "").slice(0, 1200)}`.toLowerCase();
  const euHints = ["europe", "emea", "eu ", "uk", "gmt", "cet", "cest", "eet", "bst", "london", "berlin", "paris", "amsterdam", "dublin"];
  const usHints = ["united states", "usa", "us ", "america", "est", "edt", "pst", "pdt", "cst", "cdt", "mst", "mdt", " et", " pt", "nyc", "san francisco"];
  if (euHints.some((hint) => text.includes(hint))) return "eu";
  if (usHints.some((hint) => text.includes(hint))) return "us";
  return "unknown";
};

const toolSignals = (job: Job) => new Set([...(job.tools || []), ...(job.tags || [])].map((value) => value.toLowerCase()));

const jobHasSelectedTools = (job: Job, tools: string[]) => {
  if (tools.length === 0) return true;
  const tokens = toolSignals(job);
  return tools.every((tool) => {
    const key = tool.toLowerCase();
    if (key === "make") return tokens.has("make") || tokens.has("make.com");
    if (key === "google sheets") return tokens.has("google sheets") || tokens.has("sheets");
    return tokens.has(key);
  });
};

/** Same rules as the board filters. Runs on the full catalog, then the caller pages the result. */
export function filterAndSortBoard(
  jobs: Job[],
  filters: BoardListFilters,
  now = Date.now(),
  descriptionIds?: ReadonlySet<string>,
): Job[] {
  const q = filters.query.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const hub = filters.category === "All Roles" ? null : getCategoryHub(filters.category);
  const saved = new Set(filters.savedIds);
  const matched = jobs.filter((job) => {
    if (!isOnNicheJob(job)) return false;
    const matchesQuery =
      !q ||
      descriptionIds?.has(job.id) ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      (job.keywords || "").toLowerCase().includes(q) ||
      (job.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
      (job.tools || []).some((tool) => tool.toLowerCase().includes(q));
    if (!matchesQuery) return false;
    if (!jobMatchesLocationQuery(job, filters.location)) return false;
    if (hub && !jobMatchesHub(job, hub)) return false;
    if (filters.workMode !== "All" && inferWorkMode(job) !== filters.workMode) return false;
    if (filters.type !== "All" && job.type !== filters.type) return false;
    const salary = parseSalaryRange(job.salary || "");
    if (filters.salaryMin > 0 && salary.max < filters.salaryMin) return false;
    if (filters.salaryMax > 0 && salary.min > filters.salaryMax) return false;
    if (filters.saved && !saved.has(job.id)) return false;
    if (!jobHasSelectedTools(job, filters.tools)) return false;
    const bucket = inferTimezoneBucket(job);
    if (filters.tz !== "any" && bucket !== filters.tz && bucket !== "unknown") return false;
    const seniority = inferSeniority(job);
    if (filters.seniority !== "any" && seniority !== filters.seniority && seniority !== "unknown") return false;
    if (filters.verified && !job.companyVerified) return false;
    return true;
  });

  matched.sort((a, b) => {
    if (filters.sort === "salary") return parseSalaryRange(b.salary || "").max - parseSalaryRange(a.salary || "").max;
    if (filters.sort === "relevant") {
      const priority = Number(isPriorityListing(b, now)) - Number(isPriorityListing(a, now));
      if (priority !== 0) return priority;
      const score = (job: Job) => {
        const base = job.matchScore ?? 0;
        if (tokens.length === 0) return base;
        const hay = `${job.title} ${job.company} ${(job.tags || []).join(" ")} ${(job.tools || []).join(" ")} ${job.keywords || ""}`.toLowerCase();
        const hit = tokens.reduce((acc, token) => (hay.includes(token) ? acc + 10 : acc), 0);
        const toolBonus = filters.tools.reduce((acc, tool) => {
          const signals = toolSignals(job);
          const key = tool.toLowerCase();
          if (key === "make") return acc + (signals.has("make") || signals.has("make.com") ? 6 : 0);
          return acc + (signals.has(key) ? 6 : 0);
        }, 0);
        const seniorityBonus = filters.seniority !== "any" && inferSeniority(job) === filters.seniority ? 6 : 0;
        return base + hit + toolBonus + seniorityBonus;
      };
      const scored = score(b) - score(a);
      if (scored !== 0) return scored;
    }
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
  return matched;
}

export type BoardFacets = {
  categories: Record<string, number>;
  work: { Remote: number; Hybrid: number };
  locations: string[];
  locationCounts: Record<string, number>;
  tools: string[];
  toolCounts: Record<string, number>;
  seniority: Record<"junior" | "mid" | "senior" | "lead", number>;
  salaryInRange: number;
};

const canonicalFacetTool = (label: string) => {
  const key = label.trim().toLowerCase();
  return KNOWN_TOOL_LABELS.find((tool) => tool.toLowerCase() === key) || label.trim();
};

/** Counts for the whole filtered catalog. Each menu ignores its own selection so the other options stay visible. */
export function boardFacets(jobs: Job[], filters: BoardListFilters, now = Date.now()): BoardFacets {
  const categories = categoryCountsForJobs(filterAndSortBoard(jobs, { ...filters, category: "All Roles" }, now));
  const workJobs = filterAndSortBoard(jobs, { ...filters, workMode: "All" }, now);
  const locationJobs = filterAndSortBoard(jobs, { ...filters, location: "" }, now);
  const locations = locationLabelsForJobs(locationJobs);
  const locationCounts: Record<string, number> = {};
  for (const label of locations) {
    locationCounts[label] = locationJobs.filter((job) => jobMatchesLocationQuery(job, label)).length;
  }
  const toolJobs = filterAndSortBoard(jobs, { ...filters, tools: [] }, now);
  const seen = new Set<string>();
  const tools: string[] = [];
  const known = new Set(KNOWN_TOOL_LABELS.map((tool) => tool.toLowerCase()));
  const add = (label: string) => {
    const trimmed = label.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || trimmed.length > 28 || seen.has(key) || workModeFromPlaceLabel(trimmed)) return;
    seen.add(key);
    tools.push(trimmed);
  };
  for (const job of toolJobs) {
    for (const raw of job.tools || []) add(canonicalFacetTool(raw));
    for (const raw of job.tags || []) {
      const label = canonicalFacetTool(raw);
      if (known.has(label.toLowerCase())) add(label);
    }
  }
  tools.sort((a, b) => a.localeCompare(b));
  const toolCounts: Record<string, number> = {};
  for (const tool of tools) toolCounts[tool] = toolJobs.filter((job) => jobHasSelectedTools(job, [tool])).length;
  const seniorityJobs = filterAndSortBoard(jobs, { ...filters, seniority: "any" }, now);
  const seniority = { junior: 0, mid: 0, senior: 0, lead: 0 };
  for (const job of seniorityJobs) {
    const level = inferSeniority(job);
    if (level !== "unknown") seniority[level] += 1;
  }
  const salaryJobs = filterAndSortBoard(jobs, { ...filters, salaryMin: 0, salaryMax: 0 }, now);
  const salaryInRange = salaryJobs.filter((job) => {
    const salary = parseSalaryRange(job.salary || "");
    if (salary.max <= 0) return false;
    if (filters.salaryMin > 0 && salary.max < filters.salaryMin) return false;
    if (filters.salaryMax > 0 && salary.min > filters.salaryMax) return false;
    return true;
  }).length;
  return {
    categories,
    work: {
      Remote: workJobs.filter((job) => inferWorkMode(job) === "Remote").length,
      Hybrid: workJobs.filter((job) => inferWorkMode(job) === "Hybrid").length,
    },
    locations,
    locationCounts,
    tools,
    toolCounts,
    seniority,
    salaryInRange,
  };
}

const timezoneBucket = (job: Job): "eu" | "us" | undefined => {
  const text = `${job.location || ""} ${job.remotePolicy || ""} ${(job.description || "").slice(0, 1200)}`.toLowerCase();
  const eu = ["europe", "emea", "eu ", "uk", "gmt", "cet", "cest", "eet", "bst", "london", "berlin", "paris", "amsterdam", "dublin"];
  const us = ["united states", "usa", "us ", "america", "est", "edt", "pst", "pdt", "cst", "cdt", "mst", "mdt", " et", " pt", "nyc", "san francisco"];
  if (eu.some((hint) => text.includes(hint))) return "eu";
  if (us.some((hint) => text.includes(hint))) return "us";
  return undefined;
};

/** The place, stored tools, and short duties the card needs, without the posting body. */
export function toBoardCard(job: Job): Job {
  const rawLocation = (job.location || "").trim();
  const shown = !rawLocation || /^(remote|hybrid)$/i.test(rawLocation) ? publicLocationLabel(job) : rawLocation;
  const mode = inferWorkMode(job);
  const tools = (job.tools || []).map((tool) => tool.trim()).filter(Boolean).slice(0, 12);
  return {
    ...job,
    location: shown || job.location,
    remotePolicy: mode || job.remotePolicy,
    tools,
    preview: rolePreviewBullets(job.description || ""),
    boardTz: timezoneBucket(job),
    description: "",
    benefits: [],
  };
}

export function pageBoard<T>(jobs: T[], skip = 0, limit = BOARD_PAGE_SIZE) {
  const safeSkip = Number.isFinite(skip) && skip > 0 ? Math.floor(skip) : 0;
  const requested = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : BOARD_PAGE_SIZE;
  const safeLimit = Math.min(BOARD_PAGE_SIZE, Math.max(1, requested));
  const page = jobs.slice(safeSkip, safeSkip + safeLimit);
  return { jobs: page, total: jobs.length, visible: page.length, skip: safeSkip, limit: safeLimit };
}

/** Anonymous responses can be shared for a short edge window. A cookie, Premium, or a saved-job filter stays on this user. */
export function publicBoardCacheControl(input: { tier: BoardTier; hasCookie: boolean; personalized: boolean }) {
  if (input.tier === "paid" || input.hasCookie || input.personalized) return "private, no-store";
  return `public, max-age=0, s-maxage=${BOARD_CDN_SECONDS}, stale-while-revalidate=${BOARD_CDN_SECONDS}`;
}

export function requestHasCookie(request: Request) {
  return Boolean(request.headers.get("cookie") || request.headers.get("authorization"));
}
