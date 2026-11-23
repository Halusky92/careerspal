import type { Job } from "../types";

type BoardSnapshot = {
  access: "guest" | "registered" | "paid";
  jobs: Job[];
  total: number | null;
};

let snapshot: BoardSnapshot | null = null;

export function rememberBoardCache(next: BoardSnapshot) {
  if (next.jobs.length === 0) return;
  if (snapshot && snapshot.access === next.access && snapshot.jobs.length > next.jobs.length) return;
  snapshot = next;
}

export function peekBoardCache(access: BoardSnapshot["access"]): BoardSnapshot | null {
  if (!snapshot || snapshot.access !== access || snapshot.jobs.length === 0) return null;
  return snapshot;
}
