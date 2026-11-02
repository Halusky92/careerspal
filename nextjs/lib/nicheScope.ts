/**
 * CareersPal public niche: remote Ops / Systems / Automation / RevOps / Product Ops / Chief of Staff.
 * Title is the source of truth. Description keywords like "systems" must not rescue a software-engineer role.
 */

const TITLE_OPS_EXCEPTION =
  /\b(revenue operations|sales operations|sales ops|marketing operations|marketing ops|product ops|product operations|business operations|bizops|revops|chief of staff|gtm operations|customer operations|customer success operations|cs ops|success ops|r&d operations|research operations|payroll operations)\b/i;

const TITLE_OFF_NICHE = [
  /\bsoftware engineer\b/i,
  /\bstaff software\b/i,
  /\bprincipal software\b/i,
  /\bfrontend engineer\b/i,
  /\bfront-end engineer\b/i,
  /\bbackend engineer\b/i,
  /\bback-end engineer\b/i,
  /\bfull[-\s]?stack\b/i,
  /\bios engineer\b/i,
  /\bandroid engineer\b/i,
  /\bmobile engineer\b/i,
  /\bplatform engineer\b/i,
  /\bsecurity engineer\b/i,
  /\bdevops engineer\b/i,
  /\bsite reliability\b/i,
  /\bml engineer\b/i,
  /\bmachine learning\b/i,
  /\bdata scientist\b/i,
  /\bdata science\b/i,
  /\bsolutions architect\b/i,
  /\bsolutions architecture\b/i,
  /\bproduct manager\b/i,
  /\bpayroll\b/i,
  /\baccountant\b/i,
  /\bsales engineer\b/i,
  /\baccount executive\b/i,
  /\bsales development\b/i,
  /\b(sdr|bdr)\b/i,
  /\bcustomer success\b/i,
  /\bcustomer support\b/i,
  /\btechnical support\b/i,
  /\bhead of marketing\b/i,
  /\bproduct marketing manager\b/i,
  /\bdesign engineer\b/i,
  /\bfinance (and|&) strategy\b/i,
  /\bcontroller\b/i,
  /\baccountant\b/i,
  /\brecruiter\b/i,
  /\btalent acquisition\b/i,
];

const TITLE_ENGINEER_GENERIC = /\bengineer(s|ing)?\b/i;
const TITLE_ENGINEER_ALLOWED =
  /\b(automation|operations|systems|sales ops|revenue|workflow|integration|revops)\b/i;

const OFF_NICHE_CATEGORIES = new Set(["Engineering & AI", "Finance & Admin", "Other", "Operations, Engineering"]);

export type NicheJobInput = {
  title?: string | null;
  category?: string | null;
  description?: string | null;
};

export function isOffNicheTitle(title?: string | null): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (TITLE_OPS_EXCEPTION.test(t)) return false;
  if (TITLE_OFF_NICHE.some((re) => re.test(t))) return true;
  if (TITLE_ENGINEER_GENERIC.test(t) && !TITLE_ENGINEER_ALLOWED.test(t)) return true;
  if (/\bsales\b/i.test(t) && !TITLE_OPS_EXCEPTION.test(t)) return true;
  return false;
}

export function isOnNicheJob(job: NicheJobInput): boolean {
  const title = (job.title || "").trim();
  const category = (job.category || "").trim();
  if (isOffNicheTitle(title)) return false;
  if (TITLE_OPS_EXCEPTION.test(title) || /\boperations\b/i.test(title)) return true;
  if (OFF_NICHE_CATEGORIES.has(category)) return false;

  const blob = `${title} ${(job.description || "").slice(0, 800)}`.toLowerCase();

  if (category === "Product Management") {
    return /\bproduct ops\b|\bproduct operations\b/.test(blob);
  }

  if (category === "Marketing & Growth Ops") {
    return (
      /\brevops\b|\brevenue operations\b|\bsales ops\b|\bmarketing ops\b|\bgtm operations\b|\bcustomer ops\b/.test(blob) ||
      TITLE_OPS_EXCEPTION.test(title)
    );
  }

  return true;
}

export function offNicheReason(job: NicheJobInput): string {
  if (isOffNicheTitle(job.title)) return "off_niche_title";
  if (OFF_NICHE_CATEGORIES.has((job.category || "").trim())) return "off_niche_category";
  if (!isOnNicheJob(job)) return "off_niche_mapping";
  return "on_niche";
}
