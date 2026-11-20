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
  /\bhybrid (schedule|position)\b|\bpartially remote\b|\b3 days (in|on site|onsite)\b|\bin office [1-5]\b|\bin-office\b|\b(?:one|two|three|four|five|\d+)\s+days\s+(?:a|per)\s+week\b|\bminimum of \d+\s+days\b/i;
/** "Hybrid role" counts only when that sentence is about the office, not a mix of duties. */
const hybridRoleIsOffice =
  /[^.?\n]*\bhybrid role\b[^.?\n]*\b(?:office|on-?site|in-office|days?\s+(?:a|per)\s+week)\b|[^.?\n]*\b(?:office|on-?site|in-office)\b[^.?\n]*\bhybrid role\b/i;
const onsiteCue = /\bonsite\b|\bon-site\b|\bin-office\b|this role is based in\b/i;
const remoteCue = /\bfully remote\b|\bremote-first\b|\bremote \(global\)\b|\bwork from home\b|\bwfh\b/i;

export function inferWorkMode(job: WorkModeInput): WorkMode | "" {
  const policy = (job.remotePolicy || "").trim();
  const location = (job.location || "").trim();
  const description = (job.description || "").slice(0, 5000);
  const blob = `${job.title || ""}\n${policy}\n${location}\n${description}`;

  if (/\bin-?person\b/i.test(job.title || "")) return "Onsite";
  if (officeSchedule.test(blob) || requiredHybrid.test(blob) || hybridRoleIsOffice.test(blob) || (basedInOffice.test(blob) && /\bremote\b/i.test(blob))) {
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
  if (titleCountry(job.title || "") || /[-–(]\s*remote\b/i.test(job.title || "")) return "Remote";
  return "";
}

/** A title suffix such as "US Remote" names the place. A country mentioned only in the body does not. */
function titleCountry(title: string): "United States" | "Canada" | "United Kingdom" | null {
  const text = title.trim();
  if (!text) return null;
  if (/\b(?:us|u\.s\.|usa|united states)\s+remote\b/i.test(text) || /\bremote\b(?:\s*[-–—(]\s*|\s+)(?:us|u\.s\.|usa)\b/i.test(text)) {
    return "United States";
  }
  if (/\bcanada\s+remote\b/i.test(text) || /\bremote\b(?:\s*[-–—(]\s*|\s+)canada\b/i.test(text)) return "Canada";
  if (/\b(?:uk|u\.k\.|united kingdom)\s+remote\b/i.test(text)) return "United Kingdom";
  return null;
}

export function workModeLabel(job: WorkModeInput) {
  return inferWorkMode(job);
}

function tidyLocationSeparators(value: string) {
  return value.replace(/(?:\s*•\s*){2,}/g, " • ").replace(/\s+/g, " ").trim();
}

/** Location as shown on the detail. Does not invent a city or a country. */
export function publicLocationLabel(job: WorkModeInput): string {
  const location = (job.location || "").trim();
  const mode = inferWorkMode(job);
  const place = geographyLabel(job);
  if (mode === "Hybrid" && /\bremote\b/i.test(`${location} ${job.remotePolicy || ""}`) && !/\bhybrid\b/i.test(location)) {
    return place && place !== "Not specified" ? tidyLocationSeparators(`Hybrid • ${place}`) : "Hybrid";
  }
  if ((mode === "Remote" || mode === "Hybrid") && place && place !== "Not specified" && (!location || /^(remote|hybrid)$/i.test(location))) {
    return tidyLocationSeparators(`${mode} • ${place}`);
  }
  if (location) return tidyLocationSeparators(location);
  return mode === "Remote" ? "Remote" : "";
}

function explicitCountry(text: string): "United States" | "Canada" | "United Kingdom" | null {
  const us =
    /\b(?:within|anywhere in|based in|located in|authorized to work in|eligible to work in)\s+the\s+united states\b/i.test(text) ||
    /\bremote\s+(?:within|in|across)\s+the\s+united states\b/i.test(text) ||
    /\b(?:united states|u\.s\.|usa)\s+only\b/i.test(text) ||
    /\bcontinental\s+(?:us|u\.s\.|united states)\b/i.test(text) ||
    /\blocated in the\s+(?:continental\s+)?(?:us|u\.s\.|united states)\b/i.test(text);
  const canada =
    /\b(?:within|anywhere in|based in|located in|authorized to work in|eligible to work in)\s+canada\b/i.test(text) ||
    /\bremote\s+(?:within|in|across)\s+canada\b/i.test(text) ||
    /\bcanada\s+only\b/i.test(text);
  const uk =
    /\b(?:within|anywhere in|based in|located in|authorized to work in|eligible to work in)\s+the\s+united kingdom\b/i.test(text) ||
    /\b(?:uk|u\.k\.|united kingdom)\s+only\b/i.test(text);
  const hits = [us, canada, uk].filter(Boolean).length;
  if (hits !== 1) return null;
  if (us) return "United States";
  if (canada) return "Canada";
  return "United Kingdom";
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

/** A company sentence about customers or sales is not the place the role is hired. */
function statedDescriptionReach(text: string): "International" | "Worldwide" | "Global" | null {
  const worldwide =
    /\b(?:this role|the role|this position|the position|employees|candidates|applicants)\b[^.]{0,80}\b(?:worldwide|world-wide|anywhere in the world)\b/i.test(text) ||
    /\bwork from anywhere\b(?!\s+in\b)/i.test(text) ||
    /\bwork anywhere\b(?!\s+in\b)/i.test(text);
  const international =
    /\bopen to international candidates\b/i.test(text) ||
    /\binternational\s+(?:candidates|applicants|employees|hires)\b/i.test(text);
  const globalRemote =
    /\bremote\b(?:\s|\(|-|\/){0,3}global\b/i.test(text) || /\bglobal\b(?:\s|\)|-|\/){0,3}remote\b/i.test(text);
  const hits = [worldwide, international, globalRemote].filter(Boolean).length;
  if (hits !== 1) return null;
  if (worldwide) return "Worldwide";
  if (international) return "International";
  return "Global";
}

function tidyStatedPlaces(raw: string): string | null {
  const text = raw
    .replace(/^(?:either|one of)\s+/i, "")
    .split(/\b(?:because|where|and we|we work|our anchor)\b/i)[0]
    .replace(/[.;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 3 || text.length > 80) return null;
  if (!/[A-Za-z]/.test(text)) return null;
  return text;
}

/** Cities the posting names as the place for this role. A company headquarters is not a work location. */
function statedRoleCities(description: string): string | null {
  const text = description.slice(0, 4000);
  const patterns = [
    /(?:this role|the role|this position|the position)\s+(?:can be|may be|will be|is|are)\s+based in\s+([^.]{3,90})/i,
    /(?:candidates?|applicants?)\s+(?:must|should|need to|will)\s+be based in\s+([^.]{3,90})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const tidy = tidyStatedPlaces(match[1]);
    if (tidy) return tidy;
  }
  return null;
}

/** Known geographic limit. Bare Remote stays Not specified. International is used only when the posting says so. */
export function geographyLabel(job: WorkModeInput): string {
  const raw = `${job.location || ""} ${job.remotePolicy || ""}`.replace(/\s+/g, " ").trim();
  const place = raw
    .replace(/\b(fully remote|remote-first|remote|hybrid|onsite|on-site|in-office|worldwide|world-wide|international|internationally|global)\b/gi, " ")
    .replace(/[()]/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/[•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (place) return place;
  const fromTitle = titleCountry(job.title || "");
  if (fromTitle) return fromTitle;
  const cities = statedRoleCities(job.description || "");
  if (cities) return cities;
  const fromLocation = statedReach(raw);
  if (fromLocation) return fromLocation;
  const restricted = explicitCountry(job.description || "");
  if (restricted) return restricted;
  const fromDescription = statedDescriptionReach((job.description || "").slice(0, 2500));
  if (fromDescription) return fromDescription;
  const mode = inferWorkMode(job);
  return mode === "Remote" || mode === "Hybrid" ? "Not specified" : "";
}
