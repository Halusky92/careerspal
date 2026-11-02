import { extractCompensationSnippet } from "./text";

export type SalaryPeriod = "year" | "month" | "day" | "hour";
export type SalaryConfidence = "high" | "medium" | "low" | "unknown";
export type SalaryDetectedFrom = "ats_structured" | "official_json" | "text_comp_section" | "text_body" | "metadata" | "unknown";

export type ParsedSalary = {
  salary_text_raw: string | null;
  salary_amount_min: number | null;
  salary_amount_max: number | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod | null;
  salary_present: boolean;
  salary_confidence: SalaryConfidence;
  salary_detected_from: SalaryDetectedFrom;
  salary_parse_notes: string[];
};

const MIN_PLAUSIBLE_BY_PERIOD: Record<SalaryPeriod, number> = {
  hour: 10,
  day: 80,
  month: 1500,
  year: 20_000,
};

const MAX_PLAUSIBLE_BY_PERIOD: Record<SalaryPeriod, number> = {
  hour: 500,
  day: 4_000,
  month: 80_000,
  year: 800_000,
};

/** Round for storage and display. Annual → nearest thousand; monthly → nearest 100; hour/day → whole units. */
export function roundSalaryAmount(amount: number, period: SalaryPeriod | string | null): number {
  if (!Number.isFinite(amount)) return amount;
  const p = (period || "").toString();
  if (p === "hour" || p === "day") return Math.round(amount);
  if (p === "month") {
    if (Math.abs(amount) < 1000) return Math.round(amount);
    return Math.round(amount / 100) * 100;
  }
  if (Math.abs(amount) < 1000) return Math.round(amount);
  return Math.round(amount / 1000) * 1000;
}

export function withRoundedSalaryAmounts<T extends {
  salary_amount_min?: number | null;
  salary_amount_max?: number | null;
  salary_period?: SalaryPeriod | string | null;
}>(parsed: T): T {
  const period = (parsed.salary_period ?? null) as SalaryPeriod | null;
  const min = parsed.salary_amount_min;
  const max = parsed.salary_amount_max;
  return {
    ...parsed,
    salary_amount_min: typeof min === "number" ? roundSalaryAmount(min, period) : min ?? null,
    salary_amount_max: typeof max === "number" ? roundSalaryAmount(max, period) : max ?? null,
  };
}

function isImplausibleSalary(period: SalaryPeriod | null, min: number | null, max: number | null): boolean {
  if (!period) return false;
  const floor = MIN_PLAUSIBLE_BY_PERIOD[period];
  const ceil = MAX_PLAUSIBLE_BY_PERIOD[period];
  const lo = typeof min === "number" && Number.isFinite(min) ? min : null;
  const hi = typeof max === "number" && Number.isFinite(max) ? max : null;
  if (lo != null && lo > 0 && lo < floor) return true;
  if (hi != null && hi > 0 && hi < floor) return true;
  if (lo != null && lo > ceil) return true;
  if (hi != null && hi > ceil) return true;
  return false;
}

const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

function normalizeNumber(value: string): number | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  const m = raw.match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    const suf = (m[2] || "").toLowerCase();
    if (suf === "k") return Math.round(n * 1_000);
    // Treat "m" as millions only for small magnitudes (e.g. 1.2m). "$325M" funding copy is not salary.
    if (suf === "m") {
      if (n > 20) return null;
      return Math.round(n * 1_000_000);
    }
    return Math.round(n);
  }
  const cleaned = raw.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeCurrency(symbolOrCode: string | null): string | null {
  const v = (symbolOrCode || "").trim();
  if (!v) return null;
  if (CURRENCY_SYMBOL_TO_CODE[v]) return CURRENCY_SYMBOL_TO_CODE[v];
  const upper = v.toUpperCase();
  if (["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "JPY"].includes(upper)) return upper;
  return null;
}

function detectPeriod(text: string): SalaryPeriod | null {
  const t = text.toLowerCase();
  if (/\b(hour|hourly|\/hr|per hour)\b/.test(t)) return "hour";
  if (/\b(day|daily|\/day|per day)\b/.test(t)) return "day";
  if (/\b(month|monthly|\/mo|per month)\b/.test(t)) return "month";
  if (/\b(year|years|yearly|annual|annually|\/yr|per year)\b/.test(t)) return "year";
  return null;
}

function isNonExplicitSalary(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("competitive salary") ||
    t.includes("competitive compensation") ||
    t.includes("depends on experience") ||
    t.includes("doe") ||
    t.includes("negotiable") ||
    t.includes("market rate")
  );
}

export function parseSalaryFromText(text: string): ParsedSalary {
  const notes: string[] = [];
  const clean = (text || "")
    .trim()
    // Normalize common dash variants to hyphen so ranges like "$221,000—$260,000" match reliably.
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");
  if (!clean) {
    return {
      salary_text_raw: null,
      salary_amount_min: null,
      salary_amount_max: null,
      salary_currency: null,
      salary_period: null,
      salary_present: false,
      salary_confidence: "unknown",
      salary_detected_from: "unknown",
      salary_parse_notes: ["empty_text"],
    };
  }

  if (isNonExplicitSalary(clean)) {
    return {
      salary_text_raw: clean.slice(0, 240),
      salary_amount_min: null,
      salary_amount_max: null,
      salary_currency: null,
      salary_period: null,
      salary_present: false,
      salary_confidence: "low",
      salary_detected_from: "text_body",
      salary_parse_notes: ["non_explicit_salary_language"],
    };
  }

  let period = detectPeriod(clean);
  if (!period) notes.push("period_missing");

  // Pattern: currency + min [- max] + period
  // Examples: $120k-$150k per year, USD 120,000 – 150,000 annual, €60/hr
  // NOTE: don't use a word-boundary before currency symbols like "$" (it's a non-word char),
  // otherwise "$120,000" won't match after whitespace.
  const re =
    /(?:^|[\s(>])\s*(USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|JPY|[$€£¥])\s*([0-9][0-9,]*(?:\.[0-9]+)?[km]?)\s*(?:[-–]\s*(?:\1\s*)?([0-9][0-9,]*(?:\.[0-9]+)?[km]?))?/i;
  const m = clean.match(re);
  if (!m) {
    return {
      salary_text_raw: null,
      salary_amount_min: null,
      salary_amount_max: null,
      salary_currency: null,
      salary_period: period,
      salary_present: false,
      salary_confidence: "unknown",
      salary_detected_from: "text_body",
      salary_parse_notes: ["no_salary_pattern_match"].concat(notes),
    };
  }

  const currency = normalizeCurrency(m[1] || null);
  if (!currency) notes.push("currency_unknown");

  const min = normalizeNumber(m[2]);
  const max = normalizeNumber(m[3] || "");
  if (!min) notes.push("min_parse_failed");
  if (m[3] && !max) notes.push("max_parse_failed");

  const salary_text_raw = m[0].trim().slice(0, 240);

  if (!period && ((min && min >= 10_000) || (max && max >= 10_000))) {
    period = "year";
    notes.push("period_assumed_year");
  }

  const present = Boolean(currency && period && (min || max));
  const confidence: SalaryConfidence = present ? "medium" : "low";

  // Sanity: guard against obvious false positives (e.g., "$1-$2") getting treated as salary.
  if (present && isImplausibleSalary(period, min, max)) {
    return {
      salary_text_raw,
      salary_amount_min: null,
      salary_amount_max: null,
      salary_currency: currency,
      salary_period: period,
      salary_present: false,
      salary_confidence: "low",
      salary_detected_from: "text_body",
      salary_parse_notes: notes.concat(["implausible_salary_amount"]),
    };
  }

  return withRoundedSalaryAmounts({
    salary_text_raw,
    salary_amount_min: min,
    salary_amount_max: max,
    salary_currency: currency,
    salary_period: period,
    salary_present: present,
    salary_confidence: confidence,
    salary_detected_from: "text_body",
    salary_parse_notes: notes.concat(["rounded_for_storage"]),
  });
}

export function parsedSalaryFromStructured(args: {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  period?: string | null;
  rawText?: string | null;
}): ParsedSalary {
  const notes: string[] = [];
  const min = typeof args.min === "number" && Number.isFinite(args.min) ? args.min : null;
  const max = typeof args.max === "number" && Number.isFinite(args.max) ? args.max : null;
  const currency = normalizeCurrency(args.currency || null);
  const periodRaw = (args.period || "").toLowerCase();
  const period: SalaryPeriod | null = periodRaw.includes("hour")
    ? "hour"
    : periodRaw.includes("day")
      ? "day"
      : periodRaw.includes("month")
        ? "month"
        : periodRaw.includes("year") || periodRaw.includes("annual")
          ? "year"
          : detectPeriod(args.rawText || "") || "year";
  if (min == null && max == null) {
    return parseSalaryFromText(args.rawText || "");
  }
  if (isImplausibleSalary(period, min, max)) {
    notes.push("implausible_structured_salary");
    return {
      salary_text_raw: (args.rawText || "").slice(0, 240) || null,
      salary_amount_min: min,
      salary_amount_max: max,
      salary_currency: currency,
      salary_period: period,
      salary_present: false,
      salary_confidence: "low",
      salary_detected_from: "ats_structured",
      salary_parse_notes: notes,
    };
  }
  return withRoundedSalaryAmounts({
    salary_text_raw: (args.rawText || `${currency || ""} ${min ?? ""}-${max ?? ""} ${period}`).trim().slice(0, 240),
    salary_amount_min: min,
    salary_amount_max: max,
    salary_currency: currency,
    salary_period: period,
    salary_present: true,
    salary_confidence: "high",
    salary_detected_from: "ats_structured" as SalaryDetectedFrom,
    salary_parse_notes: notes.concat(["rounded_for_storage"]),
  });
}

export function detectAndParseSalaryForGreenhouse(descriptionText: string): ParsedSalary {
  const clean = (descriptionText || "").trim();
  if (!clean) return parseSalaryFromText("");

  const snippet = extractCompensationSnippet(clean);
  if (snippet) {
    const parsed = parseSalaryFromText(snippet);
    if (parsed.salary_present) {
      return { ...parsed, salary_detected_from: "text_comp_section" };
    }
    // If the snippet heuristic truncated important context (e.g., "Annual" before "Base Salary"),
    // fall back to parsing the full description.
    return parseSalaryFromText(clean);
  }
  return parseSalaryFromText(clean);
}

