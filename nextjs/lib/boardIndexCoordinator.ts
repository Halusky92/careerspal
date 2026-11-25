export const BOARD_INDEX_MAX_AGE_MS = 300_000;
export const BOARD_INDEX_COALESCE_MS = 15_000;

export type BoardSnapshot<T> = {
  payload: T | null;
  builtAt: number;
  sourceUpdatedAt: string | null;
  leaseUntil: number;
};

const emptySnapshot = <T>(): BoardSnapshot<T> => ({
  payload: null,
  builtAt: 0,
  sourceUpdatedAt: null,
  leaseUntil: 0,
});

const sourceCovers = (snapshot: { sourceUpdatedAt: string | null }, sourceUpdatedAt: string | null) =>
  (snapshot.sourceUpdatedAt || "") >= (sourceUpdatedAt || "");

/** One builder across callers. A newer source inside the coalesce window reuses the snapshot. */
export async function coordinateBoardBuild<T>(args: {
  now: number;
  sourceUpdatedAt: string | null;
  read: () => Promise<BoardSnapshot<T>>;
  claim: () => Promise<boolean>;
  build: () => Promise<T>;
  write: (payload: T, builtAt: number, sourceUpdatedAt: string | null) => Promise<void>;
  release: () => Promise<void>;
  wait: (ms: number) => Promise<void>;
  maxAgeMs?: number;
  coalesceMs?: number;
  waitAttempts?: number;
  waitMs?: number;
}): Promise<{ value: T; built: boolean }> {
  const maxAgeMs = args.maxAgeMs ?? BOARD_INDEX_MAX_AGE_MS;
  const coalesceMs = args.coalesceMs ?? BOARD_INDEX_COALESCE_MS;
  const usable = (snapshot: BoardSnapshot<T>, now: number) => {
    if (snapshot.payload == null) return false;
    const age = now - snapshot.builtAt;
    if (age >= maxAgeMs) return false;
    if (sourceCovers(snapshot, args.sourceUpdatedAt)) return true;
    return age < coalesceMs;
  };
  const current = await args.read();
  if (usable(current, args.now) && current.payload != null) return { value: current.payload, built: false };

  const claimed = await args.claim();
  if (!claimed) {
    const attempts = args.waitAttempts ?? 40;
    const waitMs = args.waitMs ?? 50;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await args.wait(waitMs);
      const next = await args.read();
      if (next.builtAt > current.builtAt && usable(next, args.now) && next.payload != null) {
        return { value: next.payload, built: false };
      }
    }
    const last = await args.read();
    if (last.payload != null) return { value: last.payload, built: false };
    throw new Error("Board index is already being built.");
  }

  try {
    const again = await args.read();
    if (usable(again, args.now) && again.payload != null) return { value: again.payload, built: false };
    const value = await args.build();
    await args.write(value, args.now, args.sourceUpdatedAt);
    return { value, built: true };
  } finally {
    await args.release();
  }
}

export { emptySnapshot };
