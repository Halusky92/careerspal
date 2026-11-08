import type { SupabaseClient } from "@supabase/supabase-js";

/** Mid-market ATS boards — not the employers we want to convert to paid listings. */
export const SOURCING_SEED_BOARDS = [
  {
    displayName: "Checkr",
    sourceType: "greenhouse" as const,
    atsIdentifier: "checkr",
    baseUrl: "https://boards.greenhouse.io/checkr",
    website: "https://www.checkr.com",
  },
  {
    displayName: "Pendo",
    sourceType: "greenhouse" as const,
    atsIdentifier: "pendo",
    baseUrl: "https://boards.greenhouse.io/pendo",
    website: "https://www.pendo.io",
  },
  {
    displayName: "Gusto",
    sourceType: "greenhouse" as const,
    atsIdentifier: "gusto",
    baseUrl: "https://boards.greenhouse.io/gusto",
    website: "https://gusto.com",
  },
  {
    displayName: "GitLab",
    sourceType: "greenhouse" as const,
    atsIdentifier: "gitlab",
    baseUrl: "https://boards.greenhouse.io/gitlab",
    website: "https://about.gitlab.com",
  },
  {
    displayName: "Cloudflare",
    sourceType: "greenhouse" as const,
    atsIdentifier: "cloudflare",
    baseUrl: "https://boards.greenhouse.io/cloudflare",
    website: "https://www.cloudflare.com",
  },
  {
    displayName: "Datadog",
    sourceType: "greenhouse" as const,
    atsIdentifier: "datadog",
    baseUrl: "https://boards.greenhouse.io/datadog",
    website: "https://www.datadoghq.com",
  },
  {
    displayName: "Sentry",
    sourceType: "ashby" as const,
    atsIdentifier: "sentry",
    baseUrl: "https://jobs.ashbyhq.com/sentry",
    website: "https://sentry.io",
  },
  {
    displayName: "Asana",
    sourceType: "greenhouse" as const,
    atsIdentifier: "asana",
    baseUrl: "https://boards.greenhouse.io/asana",
    website: "https://asana.com",
  },
  {
    displayName: "Airtable",
    sourceType: "greenhouse" as const,
    atsIdentifier: "airtable",
    baseUrl: "https://boards.greenhouse.io/airtable",
    website: "https://www.airtable.com",
  },
  {
    displayName: "Figma",
    sourceType: "greenhouse" as const,
    atsIdentifier: "figma",
    baseUrl: "https://boards.greenhouse.io/figma",
    website: "https://www.figma.com",
  },
  {
    displayName: "HubSpot",
    sourceType: "greenhouse" as const,
    atsIdentifier: "hubspotjobs",
    baseUrl: "https://boards.greenhouse.io/hubspotjobs",
    website: "https://www.hubspot.com",
  },
  {
    displayName: "Intercom",
    sourceType: "greenhouse" as const,
    atsIdentifier: "intercom",
    baseUrl: "https://boards.greenhouse.io/intercom",
    website: "https://www.intercom.com",
  },
];

export async function ensureSeedSourcingBoards(sb: SupabaseClient) {
  const results: Array<{ name: string; action: "inserted" | "updated" | "unchanged"; id: string }> = [];

  for (const board of SOURCING_SEED_BOARDS) {
    const { data: companyRow } = await sb
      .from("companies")
      .select("id,website,logo_url")
      .eq("name", board.displayName)
      .maybeSingle();

    let companyId = companyRow?.id || null;
    if (!companyId) {
      const { data: created } = await sb
        .from("companies")
        .upsert(
          {
            name: board.displayName,
            website: board.website,
            logo_url: `https://www.google.com/s2/favicons?domain=${new URL(board.website).hostname}&sz=128`,
          },
          { onConflict: "name" },
        )
        .select("id")
        .single();
      companyId = created?.id || null;
    } else {
      const patch: Record<string, unknown> = {};
      if (!companyRow?.website) patch.website = board.website;
      if (!companyRow?.logo_url) {
        patch.logo_url = `https://www.google.com/s2/favicons?domain=${new URL(board.website).hostname}&sz=128`;
      }
      if (Object.keys(patch).length > 0) {
        await sb.from("companies").update(patch).eq("id", companyId);
      }
    }

    const normalizedUrl = board.baseUrl.replace(/\/+$/, "");
    const { data: existing } = await sb
      .from("sourcing_sources")
      .select("id,enabled,validation_state,source_type,ats_identifier,company_id")
      .or(`ats_identifier.eq.${board.atsIdentifier},normalized_url.eq.${normalizedUrl}`)
      .limit(1)
      .maybeSingle();

    const payload = {
      display_name: board.displayName,
      base_url: board.baseUrl,
      normalized_url: normalizedUrl,
      source_type: board.sourceType,
      ats_identifier: board.atsIdentifier,
      company_id: companyId,
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
      existing.ats_identifier !== board.atsIdentifier ||
      (!existing.company_id && Boolean(companyId));

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
