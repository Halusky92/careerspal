export type EmploymentType =
  | "Full-time"
  | "Part-time"
  | "Contract"
  | "Freelance"
  | "Internship"
  | "Temporary";

type DetectArgs = {
  title?: string | null;
  description?: string | null;
  locationText?: string | null;
  remotePolicy?: string | null;
  headerText?: string | null;
};

function hasExplicit(needle: RegExp, hay: string) {
  return needle.test(hay);
}

/** A deal-desk sentence about "contracting" is not an employment type. */
function explicitContract(text: string) {
  return (
    /\b1099\b|\bc2c\b|\bcontractor\b/.test(text) ||
    /\bcontract\s+(role|position|employment|employee|basis)\b/.test(text) ||
    /\bthis is a contract\b|\bcontract\s+to\s+hire\b|\bfixed-term contract\b/.test(text) ||
    /\b\d+[-\s]month contract\b/.test(text)
  );
}

export function detectEmploymentType(args: DetectArgs): { type: EmploymentType | null; confidence: "high" | "medium" | "low" } {
  const titleHeader = [args.title, args.headerText, args.locationText, args.remotePolicy]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const description = (args.description || "").toLowerCase().replace(/\s+/g, " ").trim();
  const t = `${titleHeader} ${description}`.trim();
  if (!t) return { type: null, confidence: "low" };

  // Order matters: choose the most specific first.
  // We only return a type when language is explicit.
  if (hasExplicit(/\bintern(ship)?\b/, t)) return { type: "Internship", confidence: "high" };
  if (hasExplicit(/\btemporary\b|\btemp\b(?!late)\b|\bfixed[-\s]?term\b/, t)) return { type: "Temporary", confidence: "high" };
  if (hasExplicit(/\bfreelance(r)?\b/, t)) return { type: "Freelance", confidence: "high" };
  if (explicitContract(titleHeader) || explicitContract(description)) return { type: "Contract", confidence: "high" };
  if (hasExplicit(/\bpart[-\s]?time\b/, t)) return { type: "Part-time", confidence: "high" };
  if (hasExplicit(/\bfull[-\s]?time\b/, t)) return { type: "Full-time", confidence: "high" };
  if (hasExplicit(/\bcontract\b/, titleHeader) && !hasExplicit(/\bcontracting\b/, titleHeader)) {
    return { type: "Contract", confidence: "high" };
  }

  return { type: null, confidence: "low" };
}

