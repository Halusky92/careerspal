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
  CA$: "CAD",
  A$: "AUD",
  US$: "USD",
};

function collapseThousandGroups(text: string) {
  let next = text;
  let prev = "";
  while (next !== prev) {
    prev = next;
    next = prev.replace(/(\d)[ \u00a0\u202f](\d{3})(?!\d)/g, "$1$2");
  }
  return next;
}

function normalizeNumber(value: string): number | null {
  const raw = collapseThousandGroups(value || "")
    .replace(/,/g, "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    const grouped = Number(raw.replace(/\./g, ""));
    return Number.isFinite(grouped) ? grouped : null;
  }
  const m = raw.match(/^(\d+(?:\.\d+)?|\d+)(k|m)?$/i);
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
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "JPY"];

function normalizeCurrency(symbolOrCode: string | null): string | null {
  const v = (symbolOrCode || "").trim();
  if (!v) return null;
  if (CURRENCY_SYMBOL_TO_CODE[v]) return CURRENCY_SYMBOL_TO_CODE[v];
  const upper = v.toUpperCase();
  if (CURRENCY_CODES.includes(upper)) return upper;
  return null;
}

/** Currency comes from an explicit code or an unambiguous symbol. A country name or a bare $ does not confirm it. */
function currencyForSalaryMatch(symbol: string, context: string): { currency: string | null; note: string | null } {
  const prefixed = normalizeCurrency(symbol);
  if (symbol.toUpperCase() === "CA$" || symbol.toUpperCase() === "A$" || symbol.toUpperCase() === "US$") {
    return prefixed ? { currency: prefixed, note: null } : { currency: null, note: "currency_unconfirmed" };
  }
  const codes = [
    ...new Set(
      [...context.matchAll(/\b(USD|EUR|GBP|CAD|AUD|NZD|CHF|SEK|NOK|DKK|PLN|CZK|JPY)\b/gi)].map((match) => match[1].toUpperCase()),
    ),
  ];
  if (codes.length > 1) return { currency: null, note: "currency_unconfirmed" };
  if (codes.length === 1) return { currency: codes[0], note: null };
  if (symbol !== "$") {
    const fromSymbol = normalizeCurrency(symbol);
    return fromSymbol ? { currency: fromSymbol, note: null } : { currency: null, note: "currency_unconfirmed" };
  }
  return { currency: null, note: "currency_unconfirmed" };
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

function decodeSalaryEntities(text: string) {
  let next = text || "";
  for (let pass = 0; pass < 2; pass += 1) {
    next = next
      .replace(/&amp;/gi, "&")
      .replace(/&mdash;|&#8212;|&#x2014;/gi, "-")
      .replace(/&ndash;|&#8211;|&#x2013;/gi, "-")
      .replace(/&minus;|&#8722;|&#x2212;/gi, "-");
  }
  return next;
}

function absentOfficialSalary(note: string): ParsedSalary {
  return {
    salary_text_raw: null,
    salary_amount_min: null,
    salary_amount_max: null,
    salary_currency: null,
    salary_period: null,
    salary_present: false,
    salary_confidence: "low",
    salary_detected_from: "text_comp_section",
    salary_parse_notes: [note],
  };
}

function precedingIsNotBase(clean: string, index: number) {
  const before = clean.slice(Math.max(0, index - 64), index).toLowerCase();
  return /\b(ote|on-target earnings|on target earnings|up to)\b/.test(before);
}

export function parseSalaryFromText(text: string): ParsedSalary {
  const notes: string[] = [];
  const clean = collapseThousandGroups(decodeSalaryEntities(text || ""))
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

  const salaryRe =
    /(?:^|[\s(>])\s*(USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|JPY|[$€£¥])\s*([0-9][0-9,]*(?:\.[0-9]+)?[km]?)\s*(?:(?:[-–]|to|through)\s*(?:\1\s*)?([0-9][0-9,]*(?:\.[0-9]+)?[km]?))?/gi;
  const matches = [...clean.matchAll(salaryRe)];
  if (matches.length === 0) {
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
    return {
      salary_text_raw: null,
      salary_amount_min: null,
      salary_amount_max: null,
      salary_currency: null,
      salary_period: null,
      salary_present: false,
      salary_confidence: "unknown",
      salary_detected_from: "text_body",
      salary_parse_notes: ["no_salary_pattern_match"].concat(notes),
    };
  }

  const parsedMatches = matches.map((m) => {
    const localNotes = [...notes];
    const index = m.index || 0;
    const context = clean.slice(Math.max(0, index - 48), index + m[0].length + 96);
    const currency = normalizeCurrency(m[1] || null);
    if (!currency) localNotes.push("currency_unknown");
    const min = normalizeNumber(m[2]);
    const max = normalizeNumber(m[3] || "");
    if (!min) localNotes.push("min_parse_failed");
    if (m[3] && !max) localNotes.push("max_parse_failed");
    const period = periodAroundSalary(context, min, max);
    if (!period) localNotes.push("period_missing");
    const present = Boolean(currency && period && (min || max));
    const implausible = present && isImplausibleSalary(period, min, max);
    return {
      salary_text_raw: m[0].trim().slice(0, 240),
      salary_amount_min: min,
      salary_amount_max: max,
      salary_currency: currency,
      salary_period: period,
      salary_present: present && !implausible,
      salary_confidence: (present && !implausible ? "medium" : "low") as SalaryConfidence,
      salary_detected_from: "text_body" as SalaryDetectedFrom,
      salary_parse_notes: localNotes.concat(implausible ? ["implausible_salary_amount"] : ["rounded_for_storage"]),
    };
  });

  const usable = parsedMatches.filter((item) => item.salary_present);
  usable.sort((a, b) => {
    const rangeA = a.salary_amount_min != null && a.salary_amount_max != null && a.salary_amount_min !== a.salary_amount_max ? 1 : 0;
    const rangeB = b.salary_amount_min != null && b.salary_amount_max != null && b.salary_amount_min !== b.salary_amount_max ? 1 : 0;
    return rangeB - rangeA;
  });
  const chosen = usable[0] || parsedMatches[0];
  if (!chosen.salary_present) return chosen;
  return withRoundedSalaryAmounts(chosen);
}

function periodAroundSalary(context: string, min: number | null, max: number | null): SalaryPeriod | null {
  const t = context.toLowerCase();
  const amount = Math.max(min || 0, max || 0);
  if (/\b(hour|hourly|\/hr|per hour)\b/.test(t)) return "hour";
  if (/\b(per day|\/day|daily rate)\b/.test(t)) return "day";
  if (/\b(year|years|yearly|annual|annually|\/yr|per year|a year)\b/.test(t)) return "year";
  if (/\b(per month|\/mo\b|monthly)\b/.test(t) && amount > 0 && amount < 20_000) return "month";
  if (amount >= 10_000) return "year";
  if (/\b(per month|\/mo\b|monthly)\b/.test(t)) return "month";
  return detectPeriod(t);
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

/** One official base range. Several bands, an unconfirmed dollar sign, or an OTE ceiling stay unpublished. */
export function chooseOfficialSalary(text: string, _locationHint = ""): ParsedSalary {
  const clean = collapseThousandGroups(decodeSalaryEntities(text || ""))
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");
  if (!clean) return parseSalaryFromText("");
  const salaryRe =
    /(?:^|[\s(>])\s*(USD|EUR|GBP|CAD|AUD|NZD|CHF|SEK|NOK|DKK|PLN|CZK|JPY|CA\$|A\$|US\$|[$€£¥])\s*([0-9][0-9,]*(?:\.[0-9]+)?[km]?)\s*(?:(?:[-–]|to|through)\s*(?:(?:\1|CA\$|A\$|US\$|[$€£¥])\s*)?([0-9][0-9,]*(?:\.[0-9]+)?[km]?))?/gi;
  const matches = [...clean.matchAll(salaryRe)];
  const hits = matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? clean.length;
    const context = clean.slice(Math.max(0, start - 64), Math.min(next, start + match[0].length + 64));
    const min = normalizeNumber(match[2]);
    const max = normalizeNumber(match[3] || "");
    const resolved = currencyForSalaryMatch(match[1] || "", context);
    const currency = resolved.currency;
    const period = periodAroundSalary(context, min, max);
    const present = Boolean(currency && period && (min || max));
    const implausible = present && isImplausibleSalary(period, min, max);
    const notes = [
      resolved.note,
      implausible ? "implausible_salary_amount" : present ? "rounded_for_storage" : null,
    ].filter((note): note is string => Boolean(note));
    return {
      ote: precedingIsNotBase(clean, start),
      rawMin: min,
      rawMax: max,
      parsed: withRoundedSalaryAmounts({
        salary_text_raw: match[0].trim().slice(0, 240),
        salary_amount_min: present ? min : null,
        salary_amount_max: present ? max : null,
        salary_currency: present ? currency : null,
        salary_period: present ? period : null,
        salary_present: present && !implausible,
        salary_confidence: (present && !implausible ? "medium" : "low") as SalaryConfidence,
        salary_detected_from: "text_comp_section" as SalaryDetectedFrom,
        salary_parse_notes: notes,
      }),
    };
  });
  const bandKeys = new Set(
    hits
      .filter((hit) => !hit.ote && (hit.rawMin || hit.rawMax))
      .map((hit) => `${hit.rawMin ?? ""}:${hit.rawMax ?? ""}`),
  );
  if (bandKeys.size > 1) return absentOfficialSalary("multiple_salary_bands");
  const base = hits.filter((hit) => hit.parsed.salary_present && !hit.ote);
  if (base.length === 0) {
    if (hits.some((hit) => hit.ote)) return absentOfficialSalary("ote_not_base");
    if (hits.some((hit) => hit.parsed.salary_parse_notes.includes("currency_unconfirmed"))) {
      return absentOfficialSalary("currency_unconfirmed");
    }
    return parseSalaryFromText(clean);
  }
  const keys = new Set(
    base.map((hit) => `${hit.parsed.salary_currency}:${hit.parsed.salary_amount_min ?? ""}:${hit.parsed.salary_amount_max ?? ""}`),
  );
  if (keys.size > 1) return absentOfficialSalary("multiple_salary_bands");
  return base[0].parsed;
}

export function detectAndParseSalaryForGreenhouse(descriptionText: string, locationText?: string | null): ParsedSalary {
  return chooseOfficialSalary(descriptionText || "", locationText || "");
}

