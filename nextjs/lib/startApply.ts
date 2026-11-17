import { trackJobApply } from "./trackJobEvent";
import {
  applyLinkReady,
  authHrefForApply,
  currentReturnTo,
  notifyApplyBlocked,
  openCompanyApply,
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
  trackJobApply(args.jobId);
  const opened = openCompanyApply(applyUrl);
  if (!opened) {
    notifyApplyBlocked({ jobId: args.jobId, applyUrl, returnTo });
  }
  return { ok: true as const, href: null };
}
