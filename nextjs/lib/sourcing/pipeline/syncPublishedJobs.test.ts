import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUrlWouldDuplicate,
  buildSourcedJobContentPatch,
  isPaidEmployerJob,
  nightlyRefreshLeavesAdminDecision,
  omitMissingJobColumns,
  sourcedPublishBlockers,
  syncPublishedSourcedJobs,
} from "./syncPublishedJobs";
import { sourcedOriginFromSourceType } from "../origin";

const desc = `${"Ops systems and RevOps workflows. ".repeat(20)}`;

const base = {
  id: "c1",
  source_id: "s1",
  source_type: "ashby",
  payload_hash: "abc",
  published_job_id: "j1",
  apply_url: "https://jobs.ashbyhq.com/acme/1",
  title: "Revenue Operations Manager",
  location_text: "Remote - US",
  remote_policy: "Remote",
  posted_at: "2026-10-01T00:00:00.000Z",
  description_clean: desc,
  salary_text_raw: "$120k-$150k",
  salary_amount_min: 120000,
  salary_amount_max: 150000,
  salary_currency: "USD",
  salary_period: "year",
  salary_present: true,
  publish_status: "auto_published",
};

test("a still-eligible sourced job has no freshness blockers", () => {
  assert.deepEqual(sourcedPublishBlockers(base, 90, "auto_publish_candidate"), []);
});

test("salary-first holds when compensation disappears", () => {
  const noSalary = sourcedPublishBlockers(
    { ...base, salary_present: false, salary_amount_min: null, salary_amount_max: null },
    90,
    "auto_publish_candidate",
  );
  assert.ok(noSalary.includes("salary_missing"));
  assert.ok(noSalary.includes("salary_range_missing"));
});

test("thin description after an ATS rewrite is held", () => {
  const thin = sourcedPublishBlockers({ ...base, description_clean: "Short update." }, 90, "auto_publish_candidate");
  assert.ok(thin.includes("description_thin"));
});

test("onsite-only remote change is held", () => {
  const onsite = sourcedPublishBlockers(
    { ...base, remote_policy: "Onsite", location_text: "New York, NY" },
    90,
    "auto_publish_candidate",
  );
  assert.ok(onsite.includes("onsite_only"));
});

test("missing apply URL is held", () => {
  const missing = sourcedPublishBlockers({ ...base, apply_url: "#" }, 90, "auto_publish_candidate");
  assert.ok(missing.includes("apply_missing"));
});

test("off-niche title after rewrite is held", () => {
  const offNiche = sourcedPublishBlockers({ ...base, title: "Account Executive" }, 90, "auto_publish_candidate");
  assert.ok(offNiche.includes("off_niche_title"));
});

test("apply URL that already belongs to another job is a duplicate", () => {
  assert.equal(applyUrlWouldDuplicate("https://jobs.lever.co/acme/2", "https://jobs.ashbyhq.com/acme/1", true), true);
  assert.equal(applyUrlWouldDuplicate("https://jobs.ashbyhq.com/acme/1", "https://jobs.ashbyhq.com/acme/1", true), false);
  assert.equal(applyUrlWouldDuplicate("https://jobs.lever.co/acme/2", "https://jobs.ashbyhq.com/acme/1", false), false);
});

test("a refresh keeps a required office week as Hybrid and does not revert it to Remote", () => {
  const patch = buildSourcedJobContentPatch(
    {
      ...base,
      title: "Principal Business Operations Manager",
      remote_policy: "Remote",
      location_text: "United States (Remote)",
      description_clean: `${desc} Employees are expected to work from an office hub at least two days per week.`,
    },
    { applyUrl: base.apply_url || "", lastSeenAt: "2026-11-13T12:00:00.000Z" },
  );
  assert.equal(patch.remote_policy, "Hybrid");
  assert.equal("status" in patch, false);
});

test("a refresh keeps Ashby FullTime when the body only says contracting, and does not blank the type", () => {
  const patch = buildSourcedJobContentPatch(
    {
      ...base,
      title: "Senior Manager, Global Deal Desk",
      description_clean: `${desc} True-up provisions are reviewed in the quoting and contracting process.`,
      provenance: { employment_type: "Full-time" },
    },
    { applyUrl: base.apply_url || "", lastSeenAt: "2026-11-13T12:00:00.000Z" },
  );
  assert.equal(patch.type, "Full-time");
  assert.equal(
    sourcedPublishBlockers(
      {
        ...base,
        title: "Senior Manager, Global Deal Desk",
        description_clean: `${desc} True-up provisions are reviewed in the quoting and contracting process.`,
        provenance: { employment_type: "Full-time" },
      },
      90,
      "auto_publish_candidate",
    ).includes("employment_type_conflict"),
    false,
  );
});

test("a refresh does not clear employment type when the posting never states one", () => {
  const patch = buildSourcedJobContentPatch(base, {
    applyUrl: base.apply_url || "",
    lastSeenAt: "2026-11-13T12:00:00.000Z",
  });
  assert.equal("type" in patch, false);
});

test("ATS full-time against an explicit contract term is held, not rewritten", () => {
  const candidate = {
    ...base,
    title: "Operations Manager",
    description_clean: `${desc} This is a 6-month contract.`,
    provenance: { employment_type: "Full-time" },
  };
  assert.equal(sourcedPublishBlockers(candidate, 90, "auto_publish_candidate").includes("employment_type_conflict"), true);
  const patch = buildSourcedJobContentPatch(candidate, {
    applyUrl: base.apply_url || "",
    lastSeenAt: "2026-11-13T12:00:00.000Z",
  });
  assert.equal("type" in patch, false);
});

test("content patch updates salary, location, remote and apply without touching publish dates", () => {
  const patch = buildSourcedJobContentPatch(
    {
      ...base,
      source_type: "lever",
      salary_text_raw: "$140k-$160k",
      salary_amount_min: 140000,
      salary_amount_max: 160000,
      location_text: "Remote - US",
      remote_policy: "Remote",
      apply_url: "https://jobs.lever.co/acme/99",
      description_clean: `${desc} Updated scope.`,
    },
    { applyUrl: "https://jobs.lever.co/acme/99", lastSeenAt: "2026-11-09T12:00:00.000Z" },
  );
  assert.equal(patch.origin, "lever");
  assert.equal(patch.apply_url, "https://jobs.lever.co/acme/99");
  assert.equal(patch.salary_min, 140000);
  assert.equal(patch.remote_policy, "Remote");
  assert.equal(patch.last_seen_at, "2026-11-09T12:00:00.000Z");
  assert.equal("timestamp" in patch, false);
  assert.equal("published_at" in patch, false);
  assert.equal("status" in patch, false);
});

test("ATS source types keep distinct origins", () => {
  for (const type of ["greenhouse", "ashby", "lever"] as const) {
    const patch = buildSourcedJobContentPatch(
      { ...base, source_type: type },
      { applyUrl: base.apply_url || "", lastSeenAt: "2026-11-09T12:00:00.000Z" },
    );
    assert.equal(patch.origin, sourcedOriginFromSourceType(type));
    assert.deepEqual(sourcedPublishBlockers({ ...base, source_type: type }, 90, "auto_publish_candidate"), []);
  }
});

test("a missing origin column is dropped without dropping the rest of the patch", () => {
  const patch = buildSourcedJobContentPatch(base, {
    applyUrl: base.apply_url || "",
    lastSeenAt: "2026-11-09T12:00:00.000Z",
  });
  const next = omitMissingJobColumns(patch, 'column jobs.origin does not exist');
  assert.equal(next?.origin, undefined);
  assert.equal(next?.content_hash, "abc");
  assert.equal(next?.last_seen_at, "2026-11-09T12:00:00.000Z");
  assert.equal(next?.apply_url, base.apply_url);
  assert.equal(omitMissingJobColumns(patch, "permission denied"), null);
});

test("a nightly refresh does not rewrite an admin rejected or pending_review job", async () => {
  assert.equal(nightlyRefreshLeavesAdminDecision("rejected"), true);
  assert.equal(nightlyRefreshLeavesAdminDecision("pending_review"), true);
  assert.equal(nightlyRefreshLeavesAdminDecision("published"), false);

  for (const status of ["rejected", "pending_review"] as const) {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const out = await syncPublishedSourcedJobs(
      fakeSyncSb({
        candidate: { ...base, payload_hash: "changed", apply_url: "mailto:jobs@example.com" },
        job: {
          id: "j1",
          origin: "ashby",
          status,
          content_hash: "stored",
          apply_url: "mailto:jobs@example.com",
          plan_price: null,
          stripe_payment_status: null,
        },
        updates,
      }) as never,
      {},
    );
    assert.equal(out.updated, 0);
    assert.equal(out.held, 0);
    assert.equal(updates.filter((update) => update.table === "jobs").length, 0);
  }
});

test("a published job with blockers still moves to pending review", async () => {
  const updates: Array<{ table: string; payload: Record<string, unknown>; statusFilter?: string }> = [];
  const out = await syncPublishedSourcedJobs(
    fakeSyncSb({
      candidate: {
        ...base,
        payload_hash: "changed",
        apply_url: "mailto:jobs@example.com",
        salary_present: false,
        salary_amount_min: null,
        salary_amount_max: null,
      },
      job: {
        id: "j1",
        origin: "ashby",
        status: "published",
        content_hash: "stored",
        apply_url: "mailto:jobs@example.com",
        plan_price: null,
        stripe_payment_status: null,
      },
      updates,
    }) as never,
    {},
  );
  assert.equal(out.held, 1);
  const jobUpdate = updates.find((update) => update.table === "jobs");
  assert.equal(jobUpdate?.payload.status, "pending_review");
  assert.equal(jobUpdate?.statusFilter, "published");
});

function fakeSyncSb(opts: {
  candidate: Record<string, unknown>;
  job: Record<string, unknown>;
  updates: Array<{ table: string; payload: Record<string, unknown>; statusFilter?: string }>;
}) {
  return {
    from(table: string) {
      const q: {
        select: () => typeof q;
        eq: (column?: string, value?: unknown) => typeof q;
        not: () => typeof q;
        order: () => typeof q;
        limit: () => typeof q;
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        update: (payload: Record<string, unknown>) => {
          eq: (column?: string, value?: unknown) => ReturnType<typeof q.update>;
          then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
        };
        then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
      } = {
        select: () => q,
        eq: () => q,
        not: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: table === "jobs" ? opts.job : null, error: null }),
        update: (payload) => {
          let statusFilter: string | undefined;
          const write = {
            eq: (column?: string, value?: unknown) => {
              if (column === "status" && typeof value === "string") statusFilter = value;
              return write;
            },
            then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => {
              opts.updates.push({ table, payload, statusFilter });
              return Promise.resolve({ data: null, error: null }).then(onFulfilled);
            },
          };
          return write;
        },
        then: (onFulfilled) => {
          const data = table === "sourcing_sourced_job_candidates" ? [opts.candidate] : [];
          return Promise.resolve({ data, error: null }).then(onFulfilled);
        },
      };
      return q;
    },
  };
}

test("paid employer listings are skipped; sourced rows are not treated as paid", () => {
  assert.equal(isPaidEmployerJob({ origin: "employer", plan_price: 79, stripe_payment_status: "paid" }), true);
  assert.equal(isPaidEmployerJob({ origin: "ashby", plan_price: 0, stripe_payment_status: null }), false);
  assert.equal(isPaidEmployerJob({ origin: "greenhouse", plan_price: null, stripe_payment_status: null }), false);
  assert.equal(isPaidEmployerJob({ plan_price: null, stripe_payment_status: null }), false);
  assert.equal(isPaidEmployerJob({ plan_price: 0, stripe_payment_status: "founding" }), false);
});
