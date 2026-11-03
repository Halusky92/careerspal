import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { supabaseAdmin } = await import("../lib/supabaseAdmin");
  const { ensureSeedSourcingBoards } = await import("../lib/sourcing/seedBoards");
  const { ingestGreenhouseRawJobs } = await import("../lib/sourcing/pipeline/greenhouseSteps");
  const { ingestAshbyRawJobs, ingestLeverRawJobs } = await import("../lib/sourcing/pipeline/atsIngest");
  const {
    normalizeGreenhouseRawJobsToCandidates,
    evaluateCandidates,
    autoPublishEligibleCandidates,
  } = await import("../lib/sourcing/pipeline/greenhouseSteps");
  const { enrichCandidatesSalaryBulk } = await import("../lib/sourcing/pipeline/salaryEnrichment");
  const { backfillMissingCompanyLogos } = await import("../lib/sourcing/backfillCompanyLogos");

  if (!supabaseAdmin) throw new Error("Supabase not configured.");
  await ensureSeedSourcingBoards(supabaseAdmin);

  const { data: sources, error } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,source_type,validation_state,enabled")
    .in("source_type", ["greenhouse", "ashby", "lever"])
    .eq("validation_state", "allowed")
    .eq("enabled", true);

  if (error) throw error;
  const eligible = (sources || []).filter((s) => s.enabled && s.validation_state === "allowed");
  console.log(`sources=${eligible.length}`);

  for (const s of eligible) {
    const type = (s.source_type || "").toLowerCase();
    const ingest =
      type === "ashby"
        ? await ingestAshbyRawJobs(supabaseAdmin, { sourceId: s.id })
        : type === "lever"
          ? await ingestLeverRawJobs(supabaseAdmin, { sourceId: s.id })
          : await ingestGreenhouseRawJobs(supabaseAdmin, { sourceId: s.id });
    const norm = await normalizeGreenhouseRawJobsToCandidates(supabaseAdmin, { sourceId: s.id, limit: 80 });
    const ev = await evaluateCandidates(supabaseAdmin, { sourceId: s.id, limit: 80 });
    const sal = await enrichCandidatesSalaryBulk(supabaseAdmin, {
      sourceId: s.id,
      limit: 12,
      concurrency: 2,
      cooldownHours: 24,
      scanLimit: 120,
    });
    const pub = await autoPublishEligibleCandidates(supabaseAdmin, { actorId: null, sourceId: s.id, limit: 80 });
    console.log(
      JSON.stringify({
        id: s.id,
        type,
        ingest: { ran: ingest.ran, fetched: ingest.results?.[0]?.fetchedCount, inserted: ingest.results?.[0]?.insertedCount },
        norm,
        ev,
        sal: { updated: sal.updated, attempted: sal.attempted },
        pub: { processed: pub.processed, published: pub.published, skipped: pub.skipped, failed: pub.failed },
      }),
    );
  }

  const logos = await backfillMissingCompanyLogos(supabaseAdmin, 80);
  console.log("logos", logos);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
