export type WorkMode = "Remote" | "Hybrid" | "Onsite";

type WorkModeInput = {
  title?: string | null;
  remotePolicy?: string | null;
  location?: string | null;
  description?: string | null;
};

const officeSchedule =
  /\b(mondays?,\s*tuesdays?\s*and\s*thursdays?|anchor days|in-office days|office days|days in (the |our )?office)\b/i;
const basedInOffice = /\bbased in (our |the )?[a-z0-9 .,'-]{2,40} office\b/i;
const requiredHybrid =
  /\bhybrid (role|schedule|position)\b|\bpartially remote\b|\b3 days (in|on site|onsite)\b|\bin office [1-5]\b|\bin-office\b|\b(?:one|two|three|four|five|\d+)\s+days\s+(?:a|per)\s+week\b|\bminimum of \d+\s+days\b/i;
const onsiteCue = /\bonsite\b|\bon-site\b|\bin-office\b|this role is based in\b/i;
const remoteCue = /\bfully remote\b|\bremote-first\b|\bremote \(global\)\b|\bwork from home\b|\bwfh\b/i;

export function inferWorkMode(job: WorkModeInput): WorkMode | "" {
  const policy = (job.remotePolicy || "").trim();
  const location = (job.location || "").trim();
  const description = (job.description || "").slice(0, 5000);
  const blob = `${job.title || ""}\n${policy}\n${location}\n${description}`;

  if (/\bin-?person\b/i.test(job.title || "")) return "Onsite";
  if (officeSchedule.test(blob) || requiredHybrid.test(blob) || (basedInOffice.test(blob) && /\bremote\b/i.test(blob))) {
    return "Hybrid";
  }
  if (basedInOffice.test(blob) || (onsiteCue.test(blob) && !remoteCue.test(blob) && !/\bremote\b/i.test(policy))) {
    return "Onsite";
  }
  if (/\bhybrid\b/i.test(policy) || /\bhybrid\b/i.test(location)) return "Hybrid";
  if (/\bremote\b/i.test(policy) || /^\s*remote\b/i.test(location) || remoteCue.test(`${policy} ${location}`)) {
    if (onsiteCue.test(description) || basedInOffice.test(description) || officeSchedule.test(description)) {
      return "Hybrid";
    }
    return "Remote";
  }
  if (location && !/\bremote\b/i.test(location)) return "Onsite";
  if (!location && !policy && remoteCue.test(description)) return "Remote";
  return "";
}

export function workModeLabel(job: WorkModeInput) {
  return inferWorkMode(job);
}

/** Location as shown on the detail. Does not invent a city or a country. */
export function publicLocationLabel(job: WorkModeInput): string {
  const location = (job.location || "").trim();
  const mode = inferWorkMode(job);
  const place = geographyLabel(job);
  if ((mode === "Remote" || mode === "Hybrid") && place && place !== "Not specified" && (!location || /^(remote|hybrid)$/i.test(location))) {
    return `${mode} • ${place}`;
  }
  if (location) return location;
  return mode === "Remote" ? "Remote" : "";
}

function statedReach(text: string): "International" | "Worldwide" | "Global" | null {
  const worldwide = /\b(worldwide|world-wide|anywhere in the world|work from anywhere|work anywhere)\b/i.test(text);
  const international = /\binternational(?:ly)?\b/i.test(text);
  const globalRemote =
    /\bremote\b(?:\s|\(|-|\/){0,3}global\b/i.test(text) || /\bglobal\b(?:\s|\)|-|\/){0,3}remote\b/i.test(text);
  const hits = [worldwide, international, globalRemote].filter(Boolean).length;
  if (hits !== 1) return null;
  if (worldwide) return "Worldwide";
  if (international) return "International";
  return "Global";
}

/** Known geographic limit. Bare Remote stays Not specified. International is used only when the posting says so. */
export function geographyLabel(job: WorkModeInput): string {
  const raw = `${job.location || ""} ${job.remotePolicy || ""}`.replace(/\s+/g, " ").trim();
  const place = raw
    .replace(/\b(fully remote|remote-first|remote|hybrid|onsite|on-site|in-office|worldwide|world-wide|international|internationally|global)\b/gi, " ")
    .replace(/[()]/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (place) return place;
  const fromLocation = statedReach(raw);
  if (fromLocation) return fromLocation;
  const fromDescription = statedReach((job.description || "").slice(0, 2500));
  if (fromDescription) return fromDescription;
  const mode = inferWorkMode(job);
  return mode === "Remote" || mode === "Hybrid" ? "Not specified" : "";
}
