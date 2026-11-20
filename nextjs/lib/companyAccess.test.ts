import assert from "node:assert/strict";
import test from "node:test";
import {
  adminMayApprove,
  canEditCompanyProfile,
  canManageSourcedJob,
  canPostForCompany,
  employerMayManageJob,
  checkoutAllowedForCompany,
  decideAccessRequest,
  legacyEmployerMayPost,
} from "./companyAccess";

test("a free listing does not request company access", () => {
  const decision = decideAccessRequest({
    email: "ada@stripe.com",
    emailVerified: true,
    freeListing: true,
    companyWebsite: "https://stripe.com",
    alreadyMember: false,
  });
  assert.equal(decision.ok, false);
  if (!decision.ok) assert.equal(decision.code, "free_listing");
});

test("a personal email stays in manual review and cannot be approved without evidence", () => {
  const decision = decideAccessRequest({
    email: "ada@gmail.com",
    emailVerified: true,
    freeListing: false,
    companyWebsite: "https://stripe.com",
    alreadyMember: false,
  });
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.reason, "manual_review");
  assert.equal(adminMayApprove({ email: "ada@gmail.com", emailVerified: true, companyWebsite: "https://stripe.com", evidence: "" }).ok, false);
});

test("a verified corporate domain can be approved and still waits for an admin", () => {
  const decision = decideAccessRequest({
    email: "ada@stripe.com",
    emailVerified: true,
    freeListing: false,
    companyWebsite: "https://stripe.com",
    alreadyMember: false,
  });
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.manual, true);
  assert.equal(adminMayApprove({ email: "ada@stripe.com", emailVerified: true, companyWebsite: "https://stripe.com" }).ok, true);
});

test("an unverified email gets no access", () => {
  const decision = decideAccessRequest({
    email: "ada@stripe.com",
    emailVerified: false,
    freeListing: false,
    companyWebsite: "https://stripe.com",
    alreadyMember: false,
  });
  assert.equal(decision.ok, false);
});

test("a sourcing-linked job with no origin cannot be taken over", () => {
  assert.equal(employerMayManageJob({ origin: null, createdBy: "admin", profileId: "admin", linkedToSourcing: true }), "sourced");
  assert.equal(employerMayManageJob({ origin: null, createdBy: null, profileId: "employer", linkedToSourcing: false }), "forbidden");
  assert.equal(employerMayManageJob({ origin: null, createdBy: "employer", profileId: "stranger", linkedToSourcing: false }), "forbidden");
  assert.equal(employerMayManageJob({ origin: "employer", createdBy: "employer", profileId: "employer", linkedToSourcing: false }), "ok");
});

test("poster can post, only an admin edits the profile, and nobody edits sourced jobs", () => {
  assert.equal(canPostForCompany({ role: "poster", status: "active" }), true);
  assert.equal(canEditCompanyProfile({ role: "poster", status: "active" }), false);
  assert.equal(canEditCompanyProfile({ role: "admin", status: "active" }), true);
  assert.equal(canPostForCompany({ role: "poster", status: "revoked" }), false);
  assert.equal(canManageSourcedJob(), false);
});

test("an existing paying employer keeps access and a revoked employer does not", () => {
  assert.equal(legacyEmployerMayPost({ membership: null, createdCompany: true, hasOwnPricedJob: true }), true);
  assert.equal(legacyEmployerMayPost({ membership: null, createdCompany: true, hasOwnPricedJob: false }), false);
  assert.equal(
    legacyEmployerMayPost({ membership: { role: "admin", status: "revoked" }, createdCompany: true, hasOwnPricedJob: true }),
    false,
  );
});

test("checkout waits for membership unless this profile created the company", () => {
  assert.equal(checkoutAllowedForCompany({ membershipReady: true, membership: null, createdByProfile: false }), false);
  assert.equal(
    checkoutAllowedForCompany({ membershipReady: true, membership: { role: "poster", status: "active" }, createdByProfile: false }),
    true,
  );
  assert.equal(checkoutAllowedForCompany({ membershipReady: false, membership: null, createdByProfile: false }), true);
  assert.equal(
    checkoutAllowedForCompany({
      membershipReady: true,
      membership: { role: "admin", status: "revoked" },
      createdByProfile: true,
    }),
    false,
  );
});
