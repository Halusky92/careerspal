import {
  detectAndParseSalaryForGreenhouse,
  parseSalaryFromText,
  roundSalaryAmount,
  type ParsedSalary,
  type SalaryPeriod,
} from "./sourcing/normalization/salary";
import { geographyLabel } from "./workMode";

const PERIOD_LABEL: Record<SalaryPeriod, string> = {
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
  CHF: "CHF ",
};

function formatAmount(n: number, currency: string, period: SalaryPeriod | null): string {
  const rounded = roundSalaryAmount(n, period);
  const symbol = CURRENCY_SYMBOL[currency] || `${currency} `;
  const compact =
    rounded >= 10_000 ? `${Math.round(rounded / 1000)}k` : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded);
  if (symbol.endsWith(" ")) return `${symbol}${compact}`;
  return `${symbol}${compact}`;
}

function formatParsed(parsed: ParsedSalary): string | null {
  const currency = (parsed.salary_currency || "").toUpperCase();
  const min = parsed.salary_amount_min;
  const max = parsed.salary_amount_max;
  if (!currency || (min == null && max == null)) return null;
  const period = parsed.salary_period ? PERIOD_LABEL[parsed.salary_period] : "year";
  const periodKey = (parsed.salary_period || "year") as SalaryPeriod;
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo == null || hi == null) return null;
  const amount = formatAmount(lo, currency, periodKey);
  const suffix = period === "year" ? " a year" : ` / ${period}`;
  if (lo === hi) return `From ${amount}${suffix}`;
  return `${amount}–${formatAmount(hi, currency, periodKey)}${suffix}`;
}

function tidyUnparsedSalary(text: string): string {
  return text.replace(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g, (raw) => {
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n)) return raw;
    const rounded = n >= 1000 ? Math.round(n / 1000) * 1000 : Math.round(n);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded);
  });
}

function hasRange(parsed: ParsedSalary) {
  return (
    parsed.salary_amount_min != null &&
    parsed.salary_amount_max != null &&
    parsed.salary_amount_min !== parsed.salary_amount_max
  );
}

function displayFrom(parsed: ParsedSalary, fallback: string) {
  const formatted = formatParsed(parsed);
  if (formatted) return formatted;
  if (!fallback) return "Salary listed";
  return tidyUnparsedSalary(
    fallback
      .replace(/\s*-\s*/g, "–")
      .replace(/\bUSD\b/gi, "$")
      .replace(/\bEUR\b/gi, "€")
      .replace(/\bGBP\b/gi, "£")
      .replace(/\bJPY\b/gi, "¥")
      .replace(/\bCAD\b/gi, "CA$")
      .replace(/\.00\b/g, "")
      .replace(/\ba year\b/i, "/ year")
      .replace(/\bper year\b/i, "/ year")
      .replace(/\bper month\b/i, "/ month"),
  ).trim();
}

const OTHER_CURRENCY = /\b(?:CAD|AUD|EUR|GBP|NZD|CHF|SGD|HKD|INR|JPY|SEK|NOK|DKK|PLN|CZK)\b|CA\$|A\$|€|£/i;

export function formatSalaryDisplay(raw?: string | null, extraText?: string | null, place?: string | null): string {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const extra = (extraText || "").trim();
  const fromStored = text ? parseSalaryFromText(text) : parseSalaryFromText("");
  const official = extra ? detectAndParseSalaryForGreenhouse(extra, place) : null;
  if (official?.salary_parse_notes.includes("multiple_salary_bands") && OTHER_CURRENCY.test(extra)) {
    return "Salary listed";
  }
  if (official?.salary_present && official.salary_currency && official.salary_currency !== "USD") {
    return displayFrom(official, extra);
  }
  if (hasRange(fromStored)) return displayFrom(fromStored, text);
  if (extra && official && !official.salary_parse_notes.includes("multiple_salary_bands")) {
    if (official.salary_present && hasRange(official)) return displayFrom(official, extra);
    const fromFull = parseSalaryFromText(extra);
    if (hasRange(fromFull)) return displayFrom(fromFull, extra);
  }
  if (text) return displayFrom(fromStored, text);
  return "Salary listed";
}

/** The same place the card and the detail use, so the pay band follows that place. */
export function salaryPlaceHint(job: {
  location?: string | null;
  remotePolicy?: string | null;
  description?: string | null;
}) {
  const place = geographyLabel(job);
  return [job.location, job.remotePolicy, place && place !== "Not specified" ? place : ""]
    .filter(Boolean)
    .join(" ");
}

export function formatJobSalary(job: {
  salary?: string | null;
  description?: string | null;
  location?: string | null;
  remotePolicy?: string | null;
}) {
  return formatSalaryDisplay(job.salary, job.description, salaryPlaceHint(job));
}

export function formatSalaryForStorage(raw?: string | null): string {
  const display = formatSalaryDisplay(raw);
  return display === "Salary listed" ? (raw || "").trim() : display;
}

/** Stored pay text for a sourced role. A named non-dollar currency wins over a bare $ in the raw text. */
export function salaryTextForSourced(args: {
  raw?: string | null;
  currency?: string | null;
  min?: number | null;
  max?: number | null;
  period?: string | null;
}): string {
  const code = (args.currency || "").trim().toUpperCase();
  const structured =
    code && (args.min != null || args.max != null)
      ? `${code} ${args.min ?? ""}-${args.max ?? ""} ${args.period || "year"}`.replace(/\s+/g, " ").trim()
      : "";
  if (code && code !== "USD" && structured) return formatSalaryForStorage(structured);
  return formatSalaryForStorage((args.raw || "").trim() || structured);
}

/** Employer board is USD. If they type numbers without a currency, store them as dollars. */
export function formatEmployerSalaryForStorage(raw?: string | null): string {
  const text = (raw || "").replace(/\u00a0/g, " ").trim();
  if (!text) return "";
  if (/(USD|EUR|GBP|CAD|AUD|CHF|\$|€|£|¥)/i.test(text)) return formatSalaryForStorage(text);
  return formatSalaryForStorage(`$${text}`);
}
