import {
  parseSalaryFromText,
  roundSalaryAmount,
  type ParsedSalary,
  type SalaryPeriod,
} from "./sourcing/normalization/salary";

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
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);
  const symbol = CURRENCY_SYMBOL[currency] || `${currency} `;
  if (symbol.endsWith(" ")) return `${symbol}${formatted}`;
  return `${symbol}${formatted}`;
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
  const range =
    lo === hi ? formatAmount(lo, currency, periodKey) : `${formatAmount(lo, currency, periodKey)}–${formatAmount(hi, currency, periodKey)}`;
  return `${range} / ${period}`;
}

function tidyUnparsedSalary(text: string): string {
  return text.replace(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g, (raw) => {
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n)) return raw;
    const rounded = n >= 1000 ? Math.round(n / 1000) * 1000 : Math.round(n);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded);
  });
}

export function formatSalaryDisplay(raw?: string | null): string {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "Salary listed";
  const parsed = parseSalaryFromText(text);
  const formatted = formatParsed(parsed);
  if (formatted) return formatted;
  return tidyUnparsedSalary(
    text
      .replace(/\s*-\s*/g, "–")
      .replace(/\bUSD\b/gi, "$")
      .replace(/\bEUR\b/gi, "€")
      .replace(/\bGBP\b/gi, "£")
      .replace(/\bJPY\b/gi, "¥")
      .replace(/\bCAD\b/gi, "CA$")
      .replace(/\.00\b/g, "")
      .replace(/\s+year\b/i, " / year")
      .replace(/\s+month\b/i, " / month"),
  ).trim();
}

export function formatSalaryForStorage(raw?: string | null): string {
  const display = formatSalaryDisplay(raw);
  return display === "Salary listed" ? (raw || "").trim() : display;
}
