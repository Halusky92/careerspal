export const DESCRIPTION_SECTION_HEADINGS = {
  work: "What we do",
  who: "Who you are",
  pay: "Pay and benefits",
  about: "About the team",
} as const;

const HEADING_ALIASES: Record<keyof DescriptionSections, string[]> = {
  work: ["What we do", "What you'll do", "What they'll do", "What they’ll do"],
  who: [
    "Who you are",
    "Who we're looking for",
    "Who you're looking for",
    "Who you’re looking for",
  ],
  pay: ["Pay and benefits"],
  about: ["About the team"],
};

export type DescriptionSections = {
  work: string;
  who: string;
  pay: string;
  about: string;
};

export const SECTION_MAX = 1800;

export const EXAMPLE_WHO_YOU_ARE = `We're looking for someone who meets the minimums. Preferred items are a bonus, not a bar.

Minimum requirements
- Ops, systems, RevOps, or similar (consulting / analytics also fine)
- Comfort with messy data, SQL or Excel
- Clear writing with stakeholders
- Self-starter in an ambiguous environment

Preferred qualifications
- BI tools (Looker, Tableau)
- Salesforce as a user
- People management`;

export const EXAMPLE_PAY_AND_BENEFITS = `Salary range is in the field above. Use this box for extras, if you have them.

- Equity or bonus
- Health, dental, vision, retirement
- Wellness or learning stipend
- Note if pay differs by country`;

export function composeJobDescription(parts: Partial<DescriptionSections>) {
  const blocks: string[] = [];
  (["work", "who", "pay", "about"] as const).forEach((key) => {
    const body = String(parts[key] || "").trim();
    if (!body) return;
    blocks.push(`${DESCRIPTION_SECTION_HEADINGS[key]}\n${body}`);
  });
  return blocks.join("\n\n");
}

export function parseJobDescription(raw?: string | null): DescriptionSections {
  const text = String(raw || "").trim();
  const empty: DescriptionSections = { work: "", who: "", pay: "", about: "" };
  if (!text) return empty;

  const markers = (Object.keys(HEADING_ALIASES) as Array<keyof DescriptionSections>).flatMap((key) =>
    HEADING_ALIASES[key].map((heading) => ({ key, heading })),
  );
  type MarkerHit = { key: keyof DescriptionSections; heading: string; index: number };
  const hits = markers
    .map((item): MarkerHit | null => {
      const index = text.toLowerCase().indexOf(item.heading.toLowerCase());
      return index >= 0 ? { ...item, index } : null;
    })
    .filter((item): item is MarkerHit => item !== null)
    .sort((a, b) => a.index - b.index || b.heading.length - a.heading.length)
    .filter((item, index, list) => list.findIndex((other) => other.key === item.key) === index)
    .sort((a, b) => a.index - b.index);

  if (!hits.length) return { ...empty, work: text };

  const out: DescriptionSections = { ...empty };
  hits.forEach((hit, i) => {
    const start = hit.index + hit.heading.length;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    out[hit.key] = text.slice(start, end).trim();
  });
  if (hits[0].index > 0 && !out.work) {
    out.work = text.slice(0, hits[0].index).trim();
  }
  return out;
}

export function descriptionFromSections(parts: Partial<DescriptionSections>, max: number) {
  return composeJobDescription(parts).slice(0, max);
}
