/**
 * US check for the shared auto-publish gate. A role counts only when the
 * location or remote policy itself names the United States, or a remote
 * location is confirmed in the description.
 */
const US_STATE =
  "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia";

const US_COUNTRY = /\bunited states\b|\bu\.s\.a\.?\b|\bu\.s\.\b|\busa\b/i;
const US_CODE = /\bUS\b/;
const US_STATE_TEXT = new RegExp(`\\b(${US_STATE})\\b`, "i");
const US_POSTAL =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

function namesUsCountry(text: string) {
  return US_COUNTRY.test(text) || US_CODE.test(text);
}

function namesUsPlace(text: string) {
  return US_STATE_TEXT.test(text) || US_POSTAL.test(text);
}

const FOREIGN_TEXT =
  /\bunited kingdom\b|\bu\.k\.\b|\buk\b|\blondon\b|\bengland\b|\bgermany\b|\bberlin\b|\bfrance\b|\bparis\b|\bcanada\b|\btoronto\b|\bvancouver\b|\bindia\b|\baustralia\b|\bsydney\b|\bsingapore\b|\bireland\b|\bdublin\b|\bnetherlands\b|\bamsterdam\b|\beurope\b|\bemea\b|\bapac\b|\blatam\b/i;

export type UsMarketFit = "us" | "outside_us" | "unconfirmed";

export function usMarketEligibility(
  location: string | null | undefined,
  remotePolicy: string | null | undefined,
  description: string | null | undefined,
): UsMarketFit {
  const where = `${location || ""}\n${remotePolicy || ""}`;
  const whereUs = namesUsCountry(where) || namesUsPlace(where);
  const whereForeign = FOREIGN_TEXT.test(where);
  if (whereForeign && !whereUs) return "outside_us";
  if (whereUs) return "us";
  const remoteOnly = /^\s*remote\b/i.test((location || "").trim()) || /\bremote\b/i.test(remotePolicy || "");
  const descriptionUs = namesUsCountry(description || "") || US_POSTAL.test(description || "");
  const descriptionForeign = FOREIGN_TEXT.test(description || "");
  if (remoteOnly && descriptionUs && !descriptionForeign) return "us";
  if (descriptionForeign && !descriptionUs) return "outside_us";
  return "unconfirmed";
}
