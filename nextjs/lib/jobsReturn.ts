export const JOBS_RETURN_KEY = "cp_jobs_return";

export type JobsReturnPlace = {
  jobId: string;
  scrollY: number;
  visibleCount: number;
  loadedCount: number;
};

export function readJobsReturnPlace(stored: string | null | undefined): JobsReturnPlace | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<JobsReturnPlace>;
    const jobId = (parsed.jobId || "").trim();
    if (!jobId) return null;
    const scrollY = Number(parsed.scrollY);
    const visibleCount = Number(parsed.visibleCount);
    const loadedCount = Number(parsed.loadedCount);
    return {
      jobId,
      scrollY: Number.isFinite(scrollY) && scrollY > 0 ? scrollY : 0,
      visibleCount: Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : 0,
      loadedCount: Number.isFinite(loadedCount) && loadedCount > 0 ? Math.floor(loadedCount) : 0,
    };
  } catch {
    return null;
  }
}

export function jobIdToRestore(searchJobId: string | null | undefined, stored: string | null | undefined): string | null {
  const fromUrl = (searchJobId || "").trim();
  if (fromUrl) return fromUrl;
  return readJobsReturnPlace(stored)?.jobId || null;
}
