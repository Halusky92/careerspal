import { chooseDisplayedLogo, officialWebsiteUrl } from "./companyLogoUrl";

export type LogoRepair = {
  companyName: string;
  website?: string;
  logoUrl: string;
  onlyIfLogoIncludes?: string;
};

const POMELO_SITE = officialWebsiteUrl("https://pomelocare.com");
const NOTION_SITE = officialWebsiteUrl("https://www.notion.so");

/** Prepared only. Nothing here writes to the database. */
export function preparedLogoRepairs(): LogoRepair[] {
  const pomeloLogo = chooseDisplayedLogo([], POMELO_SITE);
  const notionLogo = chooseDisplayedLogo(
    ["https://www.notion.com/front-static/meta/custom-agents-og.png"],
    NOTION_SITE,
  );
  if (!POMELO_SITE || !pomeloLogo || !notionLogo) return [];
  return [
    { companyName: "pomelo-care", website: POMELO_SITE, logoUrl: pomeloLogo },
    { companyName: "Notion", logoUrl: notionLogo, onlyIfLogoIncludes: "custom-agents-og.png" },
  ];
}
