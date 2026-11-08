export function jobsForDigest<T>(matched: T[], live: T[], trial: boolean, limit = 8): T[] {
  if (matched.length) return matched.slice(0, limit);
  if (trial && live.length) return live.slice(0, limit);
  return [];
}
