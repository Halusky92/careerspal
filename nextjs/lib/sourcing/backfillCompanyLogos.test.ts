import assert from "node:assert/strict";
import test from "node:test";
import { backfillMissingCompanyLogos } from "./backfillCompanyLogos";

type Row = { id: string; website?: string | null; logo_url?: string | null; company_id?: string | null };

function memoryDb(companies: Row[], jobs: Row[]) {
  const writes: Array<{ table: string; values: Record<string, unknown>; id?: string }> = [];
  return {
    writes,
    companies,
    jobs,
    from(table: string) {
      const rows = table === "companies" ? companies : jobs;
      return {
        select() {
          return {
            order() {
              return {
                async limit() {
                  return { data: companies.map((row) => ({ ...row })), error: null };
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          const query = {
            companyId: "" as string,
            onlyMissing: false,
            eq(column: string, value: string) {
              if (column === "id" || column === "company_id") query.companyId = value;
              return query;
            },
            is(column: string, value: null) {
              if (column === "logo_url" && value === null) query.onlyMissing = true;
              return query;
            },
            async select() {
              return query.apply();
            },
            async then(resolve: (value: { data: Row[]; error: null }) => void) {
              resolve(await query.apply());
            },
            async apply() {
              writes.push({ table, values, id: query.companyId });
              const matched = rows.filter((row) => {
                const idMatch = table === "companies" ? row.id === query.companyId : row.company_id === query.companyId;
                if (!idMatch) return false;
                if (query.onlyMissing) return !String(row.logo_url || "").trim();
                return true;
              });
              for (const row of matched) Object.assign(row, values);
              return { data: matched.map((row) => ({ ...row })), error: null };
            },
          };
          return query;
        },
      };
    },
  };
}

test("a confirmed company site receives its own logo and missing jobs copy it", async () => {
  const db = memoryDb(
    [{ id: "co_notion", website: "https://www.notion.so", logo_url: null }],
    [
      { id: "job_1", company_id: "co_notion", logo_url: null },
      { id: "job_2", company_id: "co_notion", logo_url: "https://cdn.example/existing.png" },
    ],
  );
  const result = await backfillMissingCompanyLogos(db as never, 10, async () => ({
    logo_url: "https://www.notion.so/favicon.ico",
  }));
  assert.equal(result.updated, 1);
  assert.equal(result.jobsUpdated, 1);
  assert.equal(result.websitesGuessed, 0);
  assert.equal(db.companies[0].logo_url, "https://www.notion.so/favicon.ico");
  assert.equal(db.jobs[0].logo_url, "https://www.notion.so/favicon.ico");
  assert.equal(db.jobs[1].logo_url, "https://cdn.example/existing.png");
  assert.equal(db.writes.some((write) => "website" in write.values), false);
});

test("an ATS address and a company without a website stay blank", async () => {
  const db = memoryDb(
    [
      { id: "co_board", website: "https://boards.greenhouse.io/acme", logo_url: null },
      { id: "co_blank", website: null, logo_url: null },
    ],
    [{ id: "job_1", company_id: "co_board", logo_url: null }],
  );
  let calls = 0;
  const result = await backfillMissingCompanyLogos(db as never, 10, async () => {
    calls += 1;
    return { logo_url: "https://example.com/should-not-be-used.png" };
  });
  assert.equal(calls, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.jobsUpdated, 0);
  assert.equal(db.companies[0].logo_url, null);
  assert.equal(db.jobs[0].logo_url, null);
});

test("a logo the company already has is copied onto listings that lack one", async () => {
  const db = memoryDb(
    [{ id: "co_known", website: "https://linear.app", logo_url: "https://linear.app/logo.png" }],
    [{ id: "job_1", company_id: "co_known", logo_url: null }],
  );
  let calls = 0;
  const result = await backfillMissingCompanyLogos(db as never, 10, async () => {
    calls += 1;
    return { logo_url: "https://example.com/other.png" };
  });
  assert.equal(calls, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.jobsUpdated, 1);
  assert.equal(db.jobs[0].logo_url, "https://linear.app/logo.png");
});
