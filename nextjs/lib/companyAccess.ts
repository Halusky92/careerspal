import { hostnameDomain, workEmailDomain } from "./workEmailDomain";
import { isSourcedJobOrigin } from "./sourcing/origin";

export type CompanyRole = "admin" | "poster";
export type MembershipStatus = "active" | "revoked";

export type CompanyMembership = {
  role: CompanyRole;
  status: MembershipStatus;
};

export function canPostForCompany(membership: CompanyMembership | null) {
  return membership?.status === "active" && (membership.role === "admin" || membership.role === "poster");
}

export function canEditCompanyProfile(membership: CompanyMembership | null) {
  return membership?.status === "active" && membership.role === "admin";
}

/** A sourced listing stays with the pipeline. Posting rights do not edit it. */
export function canManageSourcedJob() {
  return false;
}

export function employerMayManageJob(input: {
  origin?: string | null;
  createdBy?: string | null;
  profileId: string;
  linkedToSourcing: boolean;
}) {
  if (input.linkedToSourcing || isSourcedJobOrigin(input.origin)) return "sourced" as const;
  if (input.createdBy !== input.profileId) return "forbidden" as const;
  return "ok" as const;
}

export type AccessRequestDecision =
  | { ok: true; manual: boolean; reason: "domain_match" | "manual_review" }
  | { ok: false; code: "free_listing" | "unverified_email" | "already_member" };

export function decideAccessRequest(input: {
  email?: string | null;
  emailVerified: boolean;
  freeListing: boolean;
  companyWebsite?: string | null;
  verifiedDomains?: string[];
  alreadyMember: boolean;
}): AccessRequestDecision {
  if (input.freeListing) return { ok: false, code: "free_listing" };
  if (input.alreadyMember) return { ok: false, code: "already_member" };
  if (!input.emailVerified) return { ok: false, code: "unverified_email" };
  const domain = workEmailDomain(input.email);
  const site = hostnameDomain(input.companyWebsite);
  const allowed = new Set((input.verifiedDomains || []).map((value) => hostnameDomain(value)).filter(Boolean));
  if (site) allowed.add(site);
  if (domain && allowed.has(domain)) return { ok: true, manual: true, reason: "domain_match" };
  return { ok: true, manual: true, reason: "manual_review" };
}

export function adminMayApprove(input: {
  email?: string | null;
  emailVerified: boolean;
  companyWebsite?: string | null;
  verifiedDomains?: string[];
  evidence?: string | null;
}): { ok: true; mode: "domain" | "evidence" } | { ok: false; reason: string } {
  if (!input.emailVerified) return { ok: false, reason: "email_not_verified" };
  const domain = workEmailDomain(input.email);
  const site = hostnameDomain(input.companyWebsite);
  const allowed = new Set((input.verifiedDomains || []).map((value) => hostnameDomain(value)).filter(Boolean));
  if (site) allowed.add(site);
  if (domain && allowed.has(domain)) return { ok: true, mode: "domain" };
  const evidence = (input.evidence || "").trim();
  if (evidence.length >= 40) return { ok: true, mode: "evidence" };
  return { ok: false, reason: "needs_authorization_evidence" };
}

export function legacyEmployerMayPost(input: {
  membership: CompanyMembership | null;
  createdCompany: boolean;
  hasOwnPricedJob: boolean;
}) {
  if (input.membership?.status === "revoked") return false;
  if (canPostForCompany(input.membership)) return true;
  return input.createdCompany && input.hasOwnPricedJob;
}

export function checkoutAllowedForCompany(input: {
  membershipReady: boolean;
  membership: CompanyMembership | null;
  createdByProfile: boolean;
}) {
  if (!input.membershipReady) return true;
  if (input.membership?.status === "revoked") return false;
  if (canPostForCompany(input.membership)) return true;
  if (input.createdByProfile) return true;
  return false;
}
