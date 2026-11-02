export type LeverJob = {
  id?: string;
  text?: string | null;
  hostedUrl?: string | null;
  applyUrl?: string | null;
  createdAt?: number | null;
  descriptionPlain?: string | null;
  description?: string | null;
  descriptionBody?: string | null;
  categories?: { location?: string | null; commitment?: string | null; team?: string | null; department?: string | null } | null;
  salaryRange?: { min?: number | null; max?: number | null; currency?: string | null; interval?: string | null } | null;
  workplaceType?: string | null;
};

export async function fetchLeverPostings(boardToken: string): Promise<LeverJob[]> {
  const token = (boardToken || "").trim();
  if (!token) return [];
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "CareersPalSourcing/1.0" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Lever list failed (${res.status})`);
  const json = (await res.json()) as LeverJob[];
  return (Array.isArray(json) ? json : []).filter((job) => Boolean(job.id));
}

export function inferLeverBoardTokenFromUrl(value: string): string | null {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "jobs.lever.co" && host !== "api.lever.co") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "api.lever.co" && parts[0] === "v0" && parts[1] === "postings") return parts[2] || null;
    return parts[0] || null;
  } catch {
    return null;
  }
}
