export const DESCRIPTION_SECTION_HEADINGS = {
  work: "What you'll do",
  who: "Who we're looking for",
  about: "About the team",
} as const;

export type DescriptionSections = {
  work: string;
  who: string;
  about: string;
};

export const SECTION_MAX = 1200;

export function composeJobDescription(parts: Partial<DescriptionSections>) {
  const blocks: string[] = [];
  (["work", "who", "about"] as const).forEach((key) => {
    const body = String(parts[key] || "").trim();
    if (!body) return;
    blocks.push(`${DESCRIPTION_SECTION_HEADINGS[key]}\n${body}`);
  });
  return blocks.join("\n\n");
}

export function parseJobDescription(raw?: string | null): DescriptionSections {
  const text = String(raw || "").trim();
  const empty: DescriptionSections = { work: "", who: "", about: "" };
  if (!text) return empty;

  const markers = [
    { key: "work" as const, heading: DESCRIPTION_SECTION_HEADINGS.work },
    { key: "who" as const, heading: DESCRIPTION_SECTION_HEADINGS.who },
    { key: "about" as const, heading: DESCRIPTION_SECTION_HEADINGS.about },
  ];
  const hits = markers
    .map((item) => {
      const index = text.toLowerCase().indexOf(item.heading.toLowerCase());
      return index >= 0 ? { ...item, index } : null;
    })
    .filter((item): item is { key: keyof DescriptionSections; heading: string; index: number } => Boolean(item))
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
