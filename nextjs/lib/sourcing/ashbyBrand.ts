import { isAshbyOrgLogo, officialWebsiteUrl } from "../companyLogoUrl";

export type AshbyBoardBrand = {
  website: string | null;
  logoUrl: string | null;
};

function readJsonString(html: string, key: string): string | null {
  const match = String(html || "").match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return null;
  try {
    const value = JSON.parse(`"${match[1]}"`) as string;
    return value.trim() || null;
  } catch {
    return null;
  }
}

/** Logo and company site embedded on the employer's public Ashby board. A name is never used. */
export function ashbyBrandFromBoardHtml(html: string): AshbyBoardBrand {
  const wordmark = readJsonString(html, "logoWordmarkImageUrl");
  const square = readJsonString(html, "logoSquareImageUrl");
  const logoUrl = [wordmark, square].find((url) => isAshbyOrgLogo(url)) || null;
  return {
    website: officialWebsiteUrl(readJsonString(html, "publicWebsite")),
    logoUrl,
  };
}

export async function fetchAshbyBoardBrand(token: string): Promise<AshbyBoardBrand> {
  const safe = token.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(safe)) return { website: null, logoUrl: null };
  const res = await fetch(`https://jobs.ashbyhq.com/${encodeURIComponent(safe)}`, {
    headers: { Accept: "text/html", "User-Agent": "CareersPalSourcing/1.0" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) return { website: null, logoUrl: null };
  const html = await res.text();
  const parsed = ashbyBrandFromBoardHtml(html);
  const wordmark = readJsonString(html, "logoWordmarkImageUrl");
  const square = readJsonString(html, "logoSquareImageUrl");
  let logoUrl: string | null = null;
  for (const candidate of [wordmark, square]) {
    if (!isAshbyOrgLogo(candidate)) continue;
    try {
      const image = await fetch(candidate as string, {
        redirect: "follow",
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "CareersPalSourcing/1.0" },
      });
      const type = image.headers.get("content-type") || "";
      await image.body?.cancel();
      if (image.ok && type.startsWith("image/")) {
        logoUrl = candidate;
        break;
      }
    } catch {
      logoUrl = null;
    }
  }
  return { website: parsed.website, logoUrl };
}
