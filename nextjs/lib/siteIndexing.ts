/** Preview and explicit staging builds must not be offered to Google. */
export function isNonProductionDeployment() {
  return process.env.STAGING === "1" || process.env.VERCEL_ENV === "preview";
}
