import { parseAlertQuery, serializeAlertQuery, jobMatchesAlertQuery } from "./categories";
import { parseSalaryFromText } from "./sourcing/normalization/salary";

export const ALERT_REGIONS = [
  { id: "anywhere", label: "Anywhere" },
  { id: "remote", label: "Remote" },
  { id: "europe", label: "Europe / EMEA" },
  { id: "us", label: "United States" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "Onsite" },
] as const;

export type AlertRegion = (typeof ALERT_REGIONS)[number]["id"];

export const ALERT_MIN_SALARIES = [0, 60000, 80000, 100000, 120000, 150000] as const;

export type AlertPrefs = {
  categories: string;
  minSalary: number | null;
  region: AlertRegion;
  token: string;
  lastSentAt?: string | null;
};

export type AlertJob = {
  title?: string | null;
  category?: string | null;
  location?: string | null;
  remote_policy?: string | null;
  salary?: string | null;
};

const isRegion = (value: string): value is AlertRegion => ALERT_REGIONS.some((item) => item.id === value);

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
      const minSalary = typeof parsed.minSalary === "number" && parsed.minSalary > 0 ? parsed.minSalary : null;
      const region = parsed.region && isRegion(parsed.region) ? parsed.region : "anywhere";
      return {
        categories,
        minSalary,
        region,
        token: (parsed.token || existingToken || "").trim() || newUnsubToken(),
        lastSentAt: parsed.lastSentAt || null,
      };
    } catch {
      // fall through
    }
  }
  return {
    categories: serializeAlertQuery(parseAlertQuery(value || "all")),
    minSalary: null,
    region: "anywhere",
    token: existingToken || newUnsubToken(),
    lastSentAt: null,
  };
}

export function serializeAlertPrefs(prefs: AlertPrefs): string {
  return JSON.stringify({
    categories: serializeAlertQuery(parseAlertQuery(prefs.categories)),
    minSalary: prefs.minSalary && prefs.minSalary > 0 ? prefs.minSalary : null,
    region: isRegion(prefs.region) ? prefs.region : "anywhere",
    token: prefs.token || newUnsubToken(),
    lastSentAt: prefs.lastSentAt || null,
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

export function jobMatchesRegion(job: AlertJob, region: AlertRegion): boolean {
  if (region === "anywhere") return true;
  const blob = `${job.location || ""} ${job.remote_policy || ""}`.toLowerCase();
  if (region === "remote") return blob.includes("remote") && !blob.includes("hybrid");
  if (region === "hybrid") return blob.includes("hybrid");
  if (region === "onsite") {
    return blob.includes("onsite") || blob.includes("on-site") || blob.includes("office") || (!blob.includes("remote") && !blob.includes("hybrid"));
  }
  if (region === "europe") {
    return /europe|emea|\beu\b|united kingdom|\buk\b|germany|france|netherlands|spain|ireland|portugal|sweden|poland/.test(blob);
  }
  if (region === "us") {
    return /\busa\b|\bus\b|united states|america|new york|california|austin|sf\b/.test(blob);
  }
  return true;
}

export function jobMatchesAlertPrefs(job: AlertJob, prefs: AlertPrefs): boolean {
  if (!jobMatchesAlertQuery(job, prefs.categories)) return false;
  if (!jobMatchesRegion(job, prefs.region)) return false;
  if (prefs.minSalary && prefs.minSalary > 0) {
    const ceiling = annualSalaryCeiling(job.salary);
    if (ceiling == null || ceiling < prefs.minSalary) return false;
  }
  return true;
}

export function isTwiceWeeklySendDay(now = new Date()): boolean {
  const day = now.getUTCDay();
  return day === 1 || day === 4;
}

export function alertPrefsLabel(prefs: AlertPrefs): string {
  const cats = parseAlertQuery(prefs.categories);
  const catLabel = cats.includes("all") ? "all categories" : cats.join(", ");
  const salary = prefs.minSalary ? `$${Math.round(prefs.minSalary / 1000)}k+` : "any salary";
  const region = ALERT_REGIONS.find((item) => item.id === prefs.region)?.label || "Anywhere";
  return `${catLabel} · ${salary} · ${region}`;
}
