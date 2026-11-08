export type WorkMode = "Remote" | "Hybrid" | "Onsite";

type WorkModeInput = {
  remotePolicy?: string | null;
  location?: string | null;
  description?: string | null;
};

const officeSchedule =
  /\b(mondays?,\s*tuesdays?\s*and\s*thursdays?|anchor days|in-office days|office days|days in (the |our )?office)\b/i;
const basedInOffice = /\bbased in (our |the )?[a-z0-9 .,'-]{2,40} office\b/i;
const hybridCue = /\bhybrid\b|partially remote|3 days (in|on site|onsite)|in office [1-5]/i;
const onsiteCue = /\bonsite\b|\bon-site\b|\bin-office\b|this role is based in\b/i;
const remoteCue = /\bfully remote\b|\bremote-first\b|\bremote \(global\)\b|\bwork from home\b|\bwfh\b/i;

export function inferWorkMode(job: WorkModeInput): WorkMode | "" {
  const policy = (job.remotePolicy || "").trim();
  const location = (job.location || "").trim();
  const description = (job.description || "").slice(0, 5000);
  const blob = `${policy}\n${location}\n${description}`;

  if (officeSchedule.test(blob) || hybridCue.test(blob) || (basedInOffice.test(blob) && /\bremote\b/i.test(blob))) {
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

/** Location as shown on the board. Does not invent a city. */
export function publicLocationLabel(job: WorkModeInput): string {
  const location = (job.location || "").trim();
  if (location) return location;
  return inferWorkMode(job) === "Remote" ? "Remote" : "";
}
