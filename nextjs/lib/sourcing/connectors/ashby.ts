export type AshbyJob = {
  id?: string;
  title?: string | null;
  departmentName?: string | null;
  teamName?: string | null;
  locationName?: string | null;
  employmentType?: string | null;
  isRemote?: boolean;
  publishedDate?: string | null;
  applyUrl?: string | null;
  jobUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  compensation?: {
    compensationTierSummary?: string | null;
    scrapeableCompensationSalarySummary?: string | null;
    compensationTiers?: Array<{
      components?: Array<{
        compensationType?: string | null;
        minValue?: number | null;
        maxValue?: number | null;
        currencyCode?: string | null;
        interval?: string | null;
      }>;
    }>;
  } | null;
};

export async function fetchAshbyJobBoard(boardToken: string): Promise<AshbyJob[]> {
  const token = (boardToken || "").trim();
  if (!token) return [];
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "CareersPalSourcing/1.0" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Ashby list failed (${res.status})`);
  const json = (await res.json()) as { jobs?: AshbyJob[] };
  return (json.jobs || []).filter((job) => Boolean(job.id));
}

export function inferAshbyBoardTokenFromUrl(value: string): string | null {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!url.hostname.replace(/^www\./, "").endsWith("ashbyhq.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] ? parts[0] : null;
  } catch {
    return null;
  }
}
