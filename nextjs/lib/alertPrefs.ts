import { formatAlertQueryLabel, parseAlertQuery, serializeAlertQuery, jobMatchesAlertQuery } from "./categories";
import { POSTING_TOOLS } from "./postingTools";
import { parseSalaryFromText } from "./sourcing/normalization/salary";

export const ALERT_REGIONS = [
  { id: "anywhere", label: "Anywhere" },
  { id: "europe", label: "Europe / EMEA" },
  { id: "us", label: "United States" },
] as const;

export const ALERT_WORK_MODES = [
  { id: "any", label: "Any" },
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "Onsite" },
] as const;

export type AlertRegion = (typeof ALERT_REGIONS)[number]["id"];
export type AlertWorkMode = (typeof ALERT_WORK_MODES)[number]["id"];

export const ALERT_MIN_SALARIES = [0, 60000, 80000, 100000, 120000, 150000] as const;

export type AlertPrefs = {
  categories: string;
  minSalary: number | null;
  region: AlertRegion;
  workMode: AlertWorkMode;
  tools: string[];
  token: string;
  lastSentAt?: string | null;
  /** Explicit false = pending double opt-in. Missing on older rows is treated as confirmed. */
  confirmed?: boolean;
};

export type AlertJob = {
  title?: string | null;
  category?: string | null;
  location?: string | null;
  remote_policy?: string | null;
  salary?: string | null;
  tools?: unknown;
  tags?: unknown;
  keywords?: string | null;
};

export type SavedSearch = {
  categories: string;
  minSalary: number | null;
  region: AlertRegion;
  workMode: AlertWorkMode;
  tools: string[];
};

const isRegion = (value: string): value is AlertRegion => ALERT_REGIONS.some((item) => item.id === value);
const isWorkMode = (value: string): value is AlertWorkMode => ALERT_WORK_MODES.some((item) => item.id === value);

/** Older alerts stored Remote, Hybrid, and Onsite in the region field. */
function readPlaceAndMode(regionRaw: unknown, modeRaw: unknown): { region: AlertRegion; workMode: AlertWorkMode } {
  const regionText = typeof regionRaw === "string" ? regionRaw : "";
  const modeText = typeof modeRaw === "string" && isWorkMode(modeRaw) ? modeRaw : null;
  if (regionText === "remote" || regionText === "hybrid" || regionText === "onsite") {
    return { region: "anywhere", workMode: modeText && modeText !== "any" ? modeText : regionText };
  }
  return { region: isRegion(regionText) ? regionText : "anywhere", workMode: modeText || "any" };
}

export function normalizeAlertTools(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const out: string[] = [];
  for (const item of raw) {
    const name = String(item || "").trim();
    const canonical = POSTING_TOOLS.find((tool) => tool.toLowerCase() === name.toLowerCase());
    if (!canonical || out.some((tool) => tool.toLowerCase() === canonical.toLowerCase())) continue;
    out.push(canonical);
  }
  return out.slice(0, 8);
}

function readMinSalary(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function newUnsubToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseAlertPrefs(raw?: string | null, existingToken?: string): AlertPrefs {
  const value = (raw || "").trim();
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as Partial<AlertPrefs> & { q?: string };
      const categories = serializeAlertQuery(parseAlertQuery(parsed.categories || parsed.q || "all"));
      const minSalary = readMinSalary(parsed.minSalary);
      const place = readPlaceAndMode(parsed.region, (parsed as { workMode?: unknown }).workMode);
      return {
        categories,
        minSalary,
        region: place.region,
        workMode: place.workMode,
        tools: normalizeAlertTools((parsed as { tools?: unknown }).tools),
        token: (parsed.token || existingToken || "").trim() || newUnsubToken(),
        lastSentAt: parsed.lastSentAt || null,
        confirmed: typeof parsed.confirmed === "boolean" ? parsed.confirmed : true,
      };
    } catch {
      // fall through
    }
  }
  return {
    categories: serializeAlertQuery(parseAlertQuery(value || "all")),
    minSalary: null,
    region: "anywhere",
    workMode: "any",
    tools: [],
    token: existingToken || newUnsubToken(),
    lastSentAt: null,
    confirmed: true,
  };
}

export function isGuestAlertConfirmed(prefs: AlertPrefs): boolean {
  return prefs.confirmed !== false;
}

export function serializeAlertPrefs(prefs: AlertPrefs): string {
  return JSON.stringify({
    categories: serializeAlertQuery(parseAlertQuery(prefs.categories)),
    minSalary: prefs.minSalary && prefs.minSalary > 0 ? prefs.minSalary : null,
    region: isRegion(prefs.region) ? prefs.region : "anywhere",
    workMode: isWorkMode(prefs.workMode) ? prefs.workMode : "any",
    tools: normalizeAlertTools(prefs.tools),
    token: prefs.token || newUnsubToken(),
    lastSentAt: prefs.lastSentAt || null,
    confirmed: prefs.confirmed !== false,
  });
}

function annualSalaryCeiling(salaryText?: string | null): number | null {
  const parsed = parseSalaryFromText(salaryText || "");
  const amount = parsed.salary_amount_max ?? parsed.salary_amount_min;
  if (amount == null || !Number.isFinite(amount)) return null;
  if (parsed.salary_period === "hour") return amount * 2080;
  if (parsed.salary_period === "day") return amount * 260;
  if (parsed.salary_period === "month") return amount * 12;
  return amount;
}

function placeBlob(job: AlertJob) {
  return `${job.location || ""} ${job.remote_policy || ""}`.toLowerCase();
}

export function jobMatchesRegion(job: AlertJob, region: AlertRegion): boolean {
  if (region === "anywhere") return true;
  const blob = placeBlob(job);
  if (region === "europe") {
    return /europe|emea|\beu\b|united kingdom|\buk\b|germany|france|netherlands|spain|ireland|portugal|sweden|poland/.test(blob);
  }
  if (region === "us") {
    return /\busa\b|\bus\b|united states|america|new york|california|austin|sf\b/.test(blob);
  }
  return true;
}

export function jobMatchesWorkMode(job: AlertJob, workMode: AlertWorkMode): boolean {
  if (workMode === "any") return true;
  const blob = placeBlob(job);
  if (workMode === "remote") return blob.includes("remote") && !blob.includes("hybrid");
  if (workMode === "hybrid") return blob.includes("hybrid");
  return blob.includes("onsite") || blob.includes("on-site") || blob.includes("office") || (!blob.includes("remote") && !blob.includes("hybrid"));
}

function storedToolTokens(job: AlertJob): Set<string> {
  const fromList = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean) : [];
  const keywords = String(job.keywords || "")
    .split(/[,|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...fromList(job.tools), ...fromList(job.tags), ...keywords]);
}

/** Every selected tool must already be stored on the role. Description text alone does not count. */
export function jobHasStoredTools(job: AlertJob, tools: string[]): boolean {
  const required = normalizeAlertTools(tools);
  if (required.length === 0) return true;
  const tokens = storedToolTokens(job);
  return required.every((tool) => {
    const key = tool.toLowerCase();
    if (key === "make") return tokens.has("make") || tokens.has("make.com");
    if (key === "google sheets") return tokens.has("google sheets") || tokens.has("sheets");
    return tokens.has(key);
  });
}

export function jobMatchesAlertPrefs(job: AlertJob, prefs: AlertPrefs): boolean {
  if (!jobMatchesAlertQuery(job, prefs.categories)) return false;
  if (!jobMatchesRegion(job, prefs.region)) return false;
  if (!jobMatchesWorkMode(job, prefs.workMode || "any")) return false;
  if (prefs.minSalary && prefs.minSalary > 0) {
    const ceiling = annualSalaryCeiling(job.salary);
    if (ceiling == null || ceiling < prefs.minSalary) return false;
  }
  if (!jobHasStoredTools(job, prefs.tools || [])) return false;
  return true;
}

export function parseSavedSearch(raw?: string | null): SavedSearch {
  const prefs = parseAlertPrefs(raw);
  return {
    categories: prefs.categories,
    minSalary: prefs.minSalary,
    region: prefs.region,
    workMode: prefs.workMode,
    tools: prefs.tools || [],
  };
}

export function serializeSavedSearch(search: SavedSearch): string {
  const categories = serializeAlertQuery(parseAlertQuery(search.categories));
  const minSalary = search.minSalary && search.minSalary > 0 ? search.minSalary : null;
  const region = isRegion(search.region) ? search.region : "anywhere";
  const workMode = isWorkMode(search.workMode) ? search.workMode : "any";
  const tools = normalizeAlertTools(search.tools);
  if (!minSalary && region === "anywhere" && workMode === "any" && tools.length === 0) return categories;
  return JSON.stringify({ categories, minSalary, region, workMode, tools });
}

export function savedSearchLabel(raw?: string | null): string {
  const search = parseSavedSearch(raw);
  const parts = [formatAlertQueryLabel(search.categories)];
  if (search.minSalary) parts.push(`$${Math.round(search.minSalary / 1000)}k+`);
  if (search.region !== "anywhere") {
    parts.push(ALERT_REGIONS.find((item) => item.id === search.region)?.label || search.region);
  }
  if (search.workMode !== "any") {
    parts.push(ALERT_WORK_MODES.find((item) => item.id === search.workMode)?.label || search.workMode);
  }
  if (search.tools.length > 0) parts.push(search.tools.join(", "));
  return parts.join(" · ");
}

export function jobMatchesSavedSearch(job: AlertJob, search: SavedSearch): boolean {
  return jobMatchesAlertPrefs(job, {
    ...search,
    token: "",
    confirmed: true,
  });
}

export function isTwiceWeeklySendDay(now = new Date()): boolean {
  const day = now.getUTCDay();
  return day === 2 || day === 5;
}

export function isWeeklySendDay(now = new Date()): boolean {
  return now.getUTCDay() === 2;
}

export function alertPrefsLabel(prefs: AlertPrefs): string {
  const cats = parseAlertQuery(prefs.categories);
  const catLabel = cats.includes("all") ? "all categories" : cats.join(", ");
  const salary = prefs.minSalary ? `$${Math.round(prefs.minSalary / 1000)}k+` : "any salary";
  const region = ALERT_REGIONS.find((item) => item.id === prefs.region)?.label || "Anywhere";
  const workMode = ALERT_WORK_MODES.find((item) => item.id === prefs.workMode)?.label || "Any";
  const tools = normalizeAlertTools(prefs.tools);
  const toolLabel = tools.length > 0 ? ` · ${tools.join(", ")}` : "";
  return `${catLabel} · ${salary} · ${region} · ${workMode}${toolLabel}`;
}
