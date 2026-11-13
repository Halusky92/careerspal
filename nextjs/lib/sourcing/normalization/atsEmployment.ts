/** Official ATS employment labels. Body text does not override these unless it states a different type explicitly. */
export function atsEmploymentLabel(value: unknown): "Full-time" | "Part-time" | "Contract" | "Freelance" | "Internship" | "Temporary" | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!raw) return null;
  if (raw === "fulltime" || raw === "permanent" || raw === "regular") return "Full-time";
  if (raw === "parttime") return "Part-time";
  if (raw === "contract" || raw === "contractor" || raw === "contracttohire") return "Contract";
  if (raw === "freelance" || raw === "freelancer") return "Freelance";
  if (raw === "intern" || raw === "internship") return "Internship";
  if (raw === "temporary" || raw === "temp" || raw === "fixedterm") return "Temporary";
  return null;
}

export function employmentTypeFromProvenance(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== "object") return null;
  const value = (provenance as { employment_type?: unknown }).employment_type;
  return atsEmploymentLabel(value);
}

export function employmentTypesConflict(atsType: string | null, textType: string | null) {
  return Boolean(atsType && textType && atsType !== textType);
}
