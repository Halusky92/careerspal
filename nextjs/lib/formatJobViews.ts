export function formatJobViews(views?: number | null) {
  const n = Math.max(0, Math.floor(Number(views) || 0));
  return n === 1 ? "1 view" : `${n} views`;
}
