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

export function detectEmploymentType(args: DetectArgs): { type: EmploymentType | null; confidence: "high" | "medium" | "low" } {
  const blob = [
    (args.title || "").toString(),
    (args.headerText || "").toString(),
    (args.locationText || "").toString(),
    (args.remotePolicy || "").toString(),
    (args.description || "").toString(),
  ]
    .join("\n")
    .toLowerCase();

  const t = blob.replace(/\s+/g, " ").trim();
  if (!t) return { type: null, confidence: "low" };

  // Order matters: choose the most specific first.
  // We only return a type when language is explicit.
  if (hasExplicit(/\bintern(ship)?\b/, t)) return { type: "Internship", confidence: "high" };
  if (hasExplicit(/\btemporary\b|\btemp\b(?!late)\b|\bfixed[-\s]?term\b/, t)) return { type: "Temporary", confidence: "high" };
  if (hasExplicit(/\bfreelance(r)?\b/, t)) return { type: "Freelance", confidence: "high" };
  if (hasExplicit(/\bcontract(or|ing)?\b|\b1099\b|\bc2c\b/, t)) return { type: "Contract", confidence: "high" };
  if (hasExplicit(/\bpart[-\s]?time\b/, t)) return { type: "Part-time", confidence: "high" };
  if (hasExplicit(/\bfull[-\s]?time\b/, t)) return { type: "Full-time", confidence: "high" };

  return { type: null, confidence: "low" };
}

