import { trackJobApply } from "./trackJobEvent";
import {
  applyLinkReady,
  authHrefForApply,
  currentReturnTo,
  openCompanyApply,
  stashPendingApply,
} from "./applyGate";

export function startApply(args: {
  accessToken?: string | null;
  jobId: string;
  applyUrl?: string | null;
  isPrivate?: boolean;
  returnTo?: string;
}) {
  const returnTo = args.returnTo || currentReturnTo();
  if (args.isPrivate && !args.accessToken) {
    return { ok: false as const, href: authHrefForApply(returnTo) };
  }
  if (!applyLinkReady(args.applyUrl)) {
    return { ok: false as const, href: null, missing: true };
  }
  const applyUrl = String(args.applyUrl).trim();
  if (!args.accessToken) {
    stashPendingApply({ jobId: args.jobId, applyUrl, returnTo });
    return { ok: false as const, href: authHrefForApply(returnTo) };
  }
  trackJobApply(args.jobId);
  openCompanyApply(applyUrl);
  return { ok: true as const, href: null };
}
