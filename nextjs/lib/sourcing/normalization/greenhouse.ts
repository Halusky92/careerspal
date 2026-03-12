import { stripHtmlToText } from "./text";
import { detectAndParseSalaryForGreenhouse, type ParsedSalary } from "./salary";

type GreenhouseJobDetail = {
  id?: number;
  title?: string | null;
  absolute_url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  content?: string | null; // HTML
  location?: { name?: string | null } | null;
  // Greenhouse may include other fields; keep it loose.
  [key: string]: unknown;
};

export type NormalizedCandidate = {
  source_type: "greenhouse";
  source_url: string;
  external_job_id: string;
  job_url: string | null;
  apply_url: string | null;
  title: string | null;
  company_name: string | null;
  location_text: string | null;
  remote_policy: string | null;
  posted_at: string | null;
  description_raw: string | null;
  description_clean: string | null;
} & ParsedSalary & {
  provenance: Record<string, unknown>;
};

function coalesceString(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const s = (v || "").toString().trim();
    if (s) return s;
  }
  return null;
}

function parseIsoMaybe(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function inferRemotePolicy(locationText: string | null): string | null {
  const t = (locationText || "").toLowerCase();
  if (!t) return null;
  if (t.includes("remote")) return "Remote";
  return null;
}

export function normalizeGreenhouseRawPayload(args: {
  sourceUrl: string;
  externalJobId: string;
  companyName?: string | null;
  rawPayload: unknown;
}): NormalizedCandidate {
  const payload = (args.rawPayload || {}) as GreenhouseJobDetail;

  const title = coalesceString(payload.title);
  const jobUrl = coalesceString(payload.absolute_url);
  // Greenhouse "apply" is typically via the posting page; treat absolute_url as job_url and apply_url for now.
  const applyUrl = jobUrl;

  const locationText = coalesceString(payload.location?.name as string | null);
  const remotePolicy = inferRemotePolicy(locationText);

  const postedAt = parseIsoMaybe(payload.created_at) || parseIsoMaybe(payload.updated_at);

  const descriptionHtml = coalesceString(payload.content);
  const descriptionClean = descriptionHtml ? stripHtmlToText(descriptionHtml) : null;

  const salary = detectAndParseSalaryForGreenhouse(descriptionClean || "");

  return {
    source_type: "greenhouse",
    source_url: args.sourceUrl,
    external_job_id: args.externalJobId,
    job_url: jobUrl,
    apply_url: applyUrl,
    title,
    company_name: coalesceString(args.companyName),
    location_text: locationText,
    remote_policy: remotePolicy,
    posted_at: postedAt,
    description_raw: descriptionHtml,
    description_clean: descriptionClean,
    ...salary,
    provenance: {
      title: payload.title ? "payload.title" : null,
      job_url: payload.absolute_url ? "payload.absolute_url" : null,
      location_text: payload.location?.name ? "payload.location.name" : null,
      posted_at: payload.created_at ? "payload.created_at" : payload.updated_at ? "payload.updated_at" : null,
      description_raw: payload.content ? "payload.content" : null,
      salary: salary.salary_detected_from,
    },
  };
}

