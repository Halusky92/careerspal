import type { Job } from "../types";

type PlaceKind = "remote" | "country" | "city";

export type PlaceOption = {
  id: string;
  label: string;
  kind: PlaceKind;
};

const COUNTRIES: { id: string; label: string; tokens: string[] }[] = [
  { id: "us", label: "United States", tokens: ["united states", "usa", "u.s.", "u.s", "america"] },
  { id: "uk", label: "United Kingdom", tokens: ["united kingdom", "uk", "england", "britain", "great britain"] },
  { id: "europe", label: "Europe", tokens: ["europe", "eu", "emea", "eea", "european"] },
  { id: "canada", label: "Canada", tokens: ["canada", "canadian"] },
  { id: "germany", label: "Germany", tokens: ["germany", "deutschland"] },
  { id: "netherlands", label: "Netherlands", tokens: ["netherlands", "holland"] },
  { id: "ireland", label: "Ireland", tokens: ["ireland"] },
  { id: "france", label: "France", tokens: ["france"] },
  { id: "australia", label: "Australia", tokens: ["australia"] },
  { id: "india", label: "India", tokens: ["india"] },
];

const CITIES: { id: string; label: string; tokens: string[]; country?: string }[] = [
  { id: "city:san-francisco", label: "San Francisco", tokens: ["san francisco", "south san francisco", "sf"], country: "us" },
  { id: "city:new-york", label: "New York", tokens: ["new york", "nyc", "new york city"], country: "us" },
  { id: "city:chicago", label: "Chicago", tokens: ["chicago"], country: "us" },
  { id: "city:seattle", label: "Seattle", tokens: ["seattle"], country: "us" },
  { id: "city:austin", label: "Austin", tokens: ["austin"], country: "us" },
  { id: "city:los-angeles", label: "Los Angeles", tokens: ["los angeles"], country: "us" },
  { id: "city:boston", label: "Boston", tokens: ["boston"], country: "us" },
  { id: "city:denver", label: "Denver", tokens: ["denver"], country: "us" },
  { id: "city:atlanta", label: "Atlanta", tokens: ["atlanta"], country: "us" },
  { id: "city:london", label: "London", tokens: ["london"], country: "uk" },
  { id: "city:berlin", label: "Berlin", tokens: ["berlin"], country: "germany" },
  { id: "city:amsterdam", label: "Amsterdam", tokens: ["amsterdam"], country: "netherlands" },
  { id: "city:dublin", label: "Dublin", tokens: ["dublin"], country: "ireland" },
  { id: "city:paris", label: "Paris", tokens: ["paris"], country: "france" },
  { id: "city:toronto", label: "Toronto", tokens: ["toronto"], country: "canada" },
];

const OPTION_BY_LABEL = new Map<string, PlaceOption>([
  ["remote", { id: "remote", label: "Remote", kind: "remote" }],
  ...COUNTRIES.map((c) => [c.label.toLowerCase(), { id: c.id, label: c.label, kind: "country" as const }] as const),
  ...CITIES.map((c) => [c.label.toLowerCase(), { id: c.id, label: c.label, kind: "city" as const }] as const),
]);

const hay = (job: Pick<Job, "location" | "remotePolicy">) =>
  `${job.location || ""} ${job.remotePolicy || ""}`.toLowerCase();

const hasToken = (text: string, token: string) => {
  if (token.includes(" ")) return text.includes(token);
  return new RegExp(`(?:^|[^a-z])${token.replace(".", "\\.")}(?:[^a-z]|$)`, "i").test(text);
};

export function placesOnJob(job: Pick<Job, "location" | "remotePolicy">): Set<string> {
  const text = hay(job);
  const ids = new Set<string>();
  if (/\bremote\b/.test(text) || /\bworldwide\b/.test(text) || /\bglobal\b/.test(text)) {
    ids.add("remote");
  }
  for (const city of CITIES) {
    if (city.tokens.some((token) => (token.includes(" ") ? text.includes(token) : hasToken(text, token)))) {
      ids.add(city.id);
      if (city.country) ids.add(city.country);
    }
  }
  for (const country of COUNTRIES) {
    if (country.tokens.some((token) => hasToken(text, token))) ids.add(country.id);
  }
  if (/(?:^|[^a-z])us(?:[^a-z]|$)/.test(text) || text.includes("u.s")) ids.add("us");
  return ids;
}

function placesFromQuery(query: string): Set<string> {
  const text = query.toLowerCase().replace(/[_/|,;]+/g, " ");
  const ids = new Set<string>();
  if (/\bremote\b/.test(text) || /\bworldwide\b/.test(text) || /\bglobal\b/.test(text)) ids.add("remote");
  for (const city of CITIES) {
    if (city.tokens.some((token) => (token.includes(" ") ? text.includes(token) : hasToken(text, token)))) {
      ids.add(city.id);
    }
  }
  for (const country of COUNTRIES) {
    if (country.tokens.some((token) => hasToken(text, token)) || text.includes(country.label.toLowerCase())) {
      ids.add(country.id);
    }
  }
  if (/(?:^|[^a-z])us(?:[^a-z]|$)/.test(text) || text.includes("u.s")) ids.add("us");
  return ids;
}

export function jobMatchesLocationQuery(job: Pick<Job, "location" | "remotePolicy">, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const exact = OPTION_BY_LABEL.get(q.toLowerCase());
  const jobPlaces = placesOnJob(job);
  if (exact) return jobPlaces.has(exact.id);
  const fromQuery = placesFromQuery(q);
  if (fromQuery.size > 0) {
    return Array.from(fromQuery).every((id) => jobPlaces.has(id));
  }
  return hay(job).includes(q.toLowerCase());
}

export function locationFilterOptions(jobs: Pick<Job, "location" | "remotePolicy">[]): PlaceOption[] {
  const present = new Set<string>();
  for (const job of jobs) {
    for (const id of placesOnJob(job)) present.add(id);
  }
  const out: PlaceOption[] = [];
  if (present.has("remote")) out.push({ id: "remote", label: "Remote", kind: "remote" });
  for (const country of COUNTRIES) {
    if (present.has(country.id)) out.push({ id: country.id, label: country.label, kind: "country" });
  }
  for (const city of CITIES) {
    if (present.has(city.id)) out.push({ id: city.id, label: city.label, kind: "city" });
  }
  return out;
}

export function locationLabelsForJobs(jobs: Pick<Job, "location" | "remotePolicy">[]): string[] {
  return locationFilterOptions(jobs).map((item) => item.label);
}
