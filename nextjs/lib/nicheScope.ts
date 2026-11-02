/**
 * CareersPal public niche: Ops / Systems / Automation / RevOps / Product Ops / Chief of Staff.
 * Title is the gate. Description must not rescue an off-niche role.
 * Default is reject: a job is on-niche only with a positive title match.
 */

const TITLE_ON_NICHE = [
  /\bchief of staff\b/i,
  /\brevops\b/i,
  /\brevenue operations\b/i,
  /\bsales operations\b/i,
  /\bsales ops\b/i,
  /\bmarketing operations\b/i,
  /\bmarketing ops\b/i,
  /\bproduct ops\b/i,
  /\bproduct operations\b/i,
  /\bbusiness operations\b/i,
  /\bbizops\b/i,
  /\bbiz ops\b/i,
  /\bgtm operations\b/i,
  /\bgo-to-market operations\b/i,
  /\bcustomer operations\b/i,
  /\bcustomer success operations\b/i,
  /\bcs ops\b/i,
  /\bsuccess ops\b/i,
  /\br&d operations\b/i,
  /\bresearch operations\b/i,
  /\bstrategy (and|&) operations\b/i,
  /\bstrategy operations\b/i,
  /\btechnical operations\b/i,
  /\bsupport operations\b/i,
  /\brevenue operations\b/i,
  /\bdeal desk\b/i,
  /\bbusiness systems\b/i,
  /\bsystems analyst\b/i,
  /\bworkflow automation\b/i,
  /\boperations (manager|lead|director|analyst|specialist|coordinator|partner|program|engineer|associate)\b/i,
  /\boperations\b.{0,40}\b(manager|lead|director|analyst|specialist|coordinator|partner|engineer|associate)\b/i,
  /\b(head|vp|director|manager|lead) of operations\b/i,
  /\binternal tools\b/i,
  /\bworkflow (specialist|engineer|manager|lead)\b/i,
  /\bops (manager|lead|director|analyst|specialist|partner|engineer)\b/i,
  /\b(sales|marketing|customer|revenue|product|business|gtm) ops\b/i,
  /\bautomation (engineer|specialist|manager|lead|ops)\b/i,
  /\bchief operating officer\b/i,
  /\binternal operations\b/i,
];

const TITLE_ON_NICHE_COMBO = [
  { need: /\bprogram manager\b/i, with: /\b(operations|ops|revops|gtm|revenue)\b/i },
  { need: /\bsystems architect\b/i, with: /\b(ops|operations|automation|zapier|make|notion|workflow)\b/i },
  { need: /\bintegration(s)? (engineer|specialist|manager)\b/i, with: /\b(ops|operations|workflow|zapier|make|workday|salesforce)\b/i },
];

const TITLE_FALSE_FRIENDS = [
  /\blegal operations\b/i,
  /\bpeople operations\b/i,
  /\bpeople ops\b/i,
  /\btalent operations\b/i,
  /\btalent ops\b/i,
  /\bhr operations\b/i,
  /\bhr ops\b/i,
  /\bit operations\b/i,
  /\bit systems\b/i,
  /\bwarehouse\b/i,
  /\bstore operations\b/i,
  /\bflight operations\b/i,
  /\bsecurity operations\b/i,
  /\bnetwork operations\b/i,
  /\bplant operations\b/i,
  /\bmanufacturing operations\b/i,
  /\bproduction operations\b/i,
  /\bclinical operations\b/i,
  /\bsurgical operations\b/i,
  /\brestaurant operations\b/i,
  /\bhotel operations\b/i,
  /\bfield operations\b/i,
  /\bsite operations\b/i,
  /\bpayroll\b/i,
  /\bfirmware\b/i,
  /\bembedded\b/i,
  /\bbenefits operations\b/i,
  /\btreasury\b/i,
  /\bcredit operations\b/i,
];

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
  /\baccountant\b/i,
  /\bsales engineer\b/i,
  /\baccount executive\b/i,
  /\bsales development\b/i,
  /\b(sdr|bdr)\b/i,
  /\bcustomer success manager\b/i,
  /\bcustomer support\b/i,
  /\btechnical support\b/i,
  /\bhead of marketing\b/i,
  /\bproduct marketing manager\b/i,
  /\bdesign engineer\b/i,
  /\bfinance (and|&) strategy\b/i,
  /\bcontroller\b/i,
  /\brecruiter\b/i,
  /\btalent acquisition\b/i,
  /\bcreative program manager\b/i,
  /\brenewal manager\b/i,
  /\bworkplace experience\b/i,
  /\bcompliance lead\b/i,
  /\bsourcing manager\b/i,
  /\bprocurement\b/i,
];

const TITLE_ENGINEER_GENERIC = /\bengineer(s|ing)?\b/i;
const TITLE_ENGINEER_ALLOWED = /\b(automation|operations|sales ops|revenue|workflow|revops|technical operations)\b/i;

const OFF_NICHE_CATEGORIES = new Set(["Engineering & AI", "Finance & Admin", "Other", "Operations, Engineering"]);

export type NicheJobInput = {
  title?: string | null;
  category?: string | null;
  description?: string | null;
};

const hasPositiveNicheTitle = (title: string) => {
  if (TITLE_ON_NICHE.some((re) => re.test(title))) return true;
  return TITLE_ON_NICHE_COMBO.some((rule) => rule.need.test(title) && rule.with.test(title));
};

export function isOffNicheTitle(title?: string | null): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (TITLE_FALSE_FRIENDS.some((re) => re.test(t))) return true;
  if (TITLE_OFF_NICHE.some((re) => re.test(t))) return true;
  if (TITLE_ENGINEER_GENERIC.test(t) && !TITLE_ENGINEER_ALLOWED.test(t)) return true;
  if (/\bsales\b/i.test(t) && !/\b(sales ops|sales operations|revops|revenue operations)\b/i.test(t)) return true;
  return false;
}

export function isOnNicheJob(job: NicheJobInput): boolean {
  const title = (job.title || "").trim();
  if (!title) return false;
  if (isOffNicheTitle(title)) return false;
  if (OFF_NICHE_CATEGORIES.has((job.category || "").trim()) && !hasPositiveNicheTitle(title)) return false;
  return hasPositiveNicheTitle(title);
}

export function offNicheReason(job: NicheJobInput): string {
  const title = (job.title || "").trim();
  if (!title) return "missing_title";
  if (isOffNicheTitle(title)) return "off_niche_title";
  if (!hasPositiveNicheTitle(title)) return "off_niche_no_title_signal";
  if (!isOnNicheJob(job)) return "off_niche_mapping";
  return "on_niche";
}

export const NICHE_REJECT_MESSAGE =
  "This board is for Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles.";
