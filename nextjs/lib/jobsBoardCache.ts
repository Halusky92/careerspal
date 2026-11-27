import type { Job } from "../types";

type BoardSnapshot = {
  access: "guest" | "registered" | "paid";
  key: string;
  jobs: Job[];
  total: number | null;
};

let snapshot: BoardSnapshot | null = null;

/** Keeps a longer page of the same filter. A different filter never overwrites or restores it. */
export function rememberBoardCache(next: BoardSnapshot) {
  if (next.jobs.length === 0) return;
  if (
    snapshot &&
    snapshot.access === next.access &&
    snapshot.key === next.key &&
    snapshot.jobs.length > next.jobs.length
  ) {
    return;
  }
  snapshot = next;
}

export function peekBoardCache(access: BoardSnapshot["access"], key: string): BoardSnapshot | null {
  if (!snapshot || snapshot.access !== access || snapshot.key !== key || snapshot.jobs.length === 0) return null;
  return snapshot;
}
