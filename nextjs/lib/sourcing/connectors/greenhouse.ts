import crypto from "crypto";

export type GreenhouseListJob = {
  id: number;
  title?: string | null;
  absolute_url?: string | null;
  updated_at?: string | null;
  location?: { name?: string | null } | null;
};

export type GreenhouseListResponse = {
  jobs?: GreenhouseListJob[];
};

export async function fetchGreenhouseJobsList(boardToken: string): Promise<GreenhouseListJob[]> {
  const token = (boardToken || "").trim();
  if (!token) return [];

  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "CareersPalSourcing/1.0",
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Greenhouse list failed (${res.status})`);
  }
  const json = (await res.json()) as GreenhouseListResponse;
  return (json.jobs || []).filter((j) => typeof j.id === "number");
}

export async function fetchGreenhouseJobDetail(boardToken: string, jobId: number): Promise<unknown> {
  const token = (boardToken || "").trim();
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs/${encodeURIComponent(
    String(jobId),
  )}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "CareersPalSourcing/1.0",
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Greenhouse detail failed (${res.status})`);
  }
  return (await res.json()) as unknown;
}

export function inferGreenhouseBoardTokenFromUrl(value: string): string | null {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const parts = url.pathname.split("/").filter(Boolean);
    // Typical: https://boards.greenhouse.io/{token} or .../{token}/jobs/123
    return parts[0] ? parts[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function sha256Json(value: unknown): string {
  const text = JSON.stringify(value);
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift() as T;
      // eslint-disable-next-line no-await-in-loop
      const r = await fn(item);
      out.push(r);
    }
  });
  await Promise.all(workers);
  return out;
}

