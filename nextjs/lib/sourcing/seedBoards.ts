import type { SupabaseClient } from "@supabase/supabase-js";

/** Mid-market ATS boards — not the employers we want to convert to paid listings. */
export const SOURCING_SEED_BOARDS = [
  {
    displayName: "Checkr",
    sourceType: "greenhouse" as const,
    atsIdentifier: "checkr",
    baseUrl: "https://boards.greenhouse.io/checkr",
  },
  {
    displayName: "Pendo",
    sourceType: "greenhouse" as const,
    atsIdentifier: "pendo",
    baseUrl: "https://boards.greenhouse.io/pendo",
  },
];

export async function ensureSeedSourcingBoards(sb: SupabaseClient) {
  const results: Array<{ name: string; action: "inserted" | "updated" | "unchanged"; id: string }> = [];

  for (const board of SOURCING_SEED_BOARDS) {
    const normalizedUrl = board.baseUrl.replace(/\/+$/, "");
    const { data: existing } = await sb
      .from("sourcing_sources")
      .select("id,enabled,validation_state,source_type,ats_identifier")
      .or(`ats_identifier.eq.${board.atsIdentifier},normalized_url.eq.${normalizedUrl}`)
      .limit(1)
      .maybeSingle();

    const payload = {
      display_name: board.displayName,
      base_url: board.baseUrl,
      normalized_url: normalizedUrl,
      source_type: board.sourceType,
      ats_identifier: board.atsIdentifier,
      validation_state: "allowed",
      validation_confidence: "high",
      enabled: true,
      approval_decision: "approved_as_official_ats",
      approval_notes: "Seeded mid-market ATS board for daily ingest.",
      last_validated_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    };

    if (!existing?.id) {
      const { data: inserted, error } = await sb
        .from("sourcing_sources")
        .insert(payload)
        .select("id")
        .single();
      if (error || !inserted?.id) throw new Error(`Unable to insert ${board.displayName}: ${error?.message || "unknown"}`);
      results.push({ name: board.displayName, action: "inserted", id: inserted.id });
      continue;
    }

    const needsUpdate =
      existing.enabled !== true ||
      existing.validation_state !== "allowed" ||
      existing.source_type !== board.sourceType ||
      existing.ats_identifier !== board.atsIdentifier;

    if (needsUpdate) {
      const { error } = await sb.from("sourcing_sources").update(payload).eq("id", existing.id);
      if (error) throw new Error(`Unable to update ${board.displayName}: ${error.message}`);
      results.push({ name: board.displayName, action: "updated", id: existing.id });
    } else {
      results.push({ name: board.displayName, action: "unchanged", id: existing.id });
    }
  }

  return results;
}
