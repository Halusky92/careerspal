export const JOBS_RETURN_KEY = "cp_jobs_return";

export function jobIdToRestore(searchJobId: string | null | undefined, stored: string | null | undefined): string | null {
  const fromUrl = (searchJobId || "").trim();
  if (fromUrl) return fromUrl;
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { jobId?: string };
    const jobId = (parsed.jobId || "").trim();
    return jobId || null;
  } catch {
    return null;
  }
}
