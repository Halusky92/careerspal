export const GOOGLE_INDEXING_TEST_BATCH = 5;
export const DESCRIPTION_READ_CAP = 40;

export function pacificDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || "0");
  const year = value("year");
  const month = value("month");
  const day = value("day");
  let hour = value("hour");
  const minute = value("minute");
  const second = value("second");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = asUtc - now.getTime();
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offset);
}

export function quotaAttempts(
  rows: Array<{ attempts?: number | null; createdAt?: string | null }>,
  now: Date,
): number {
  const start = pacificDayStart(now).toISOString();
  return rows.reduce((sum, row) => {
    if (!row.createdAt || row.createdAt < start) return sum;
    const attempts = Number(row.attempts);
    return sum + (Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0);
  }, 0);
}

export function batchCap(input: { live: boolean; requested?: number | null }): number {
  const requested = input.requested && input.requested > 0 ? Math.floor(input.requested) : GOOGLE_INDEXING_TEST_BATCH;
  if (!input.live) return Math.min(GOOGLE_INDEXING_TEST_BATCH, requested);
  return Math.min(40, requested);
}

export function descriptionReadCap(batch: number): number {
  return Math.min(DESCRIPTION_READ_CAP, Math.max(batch * 4, batch));
}
