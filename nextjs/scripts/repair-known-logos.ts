import fs from "node:fs";
import { createRequire } from "node:module";
import { chooseDisplayedLogo, officialWebsiteUrl } from "../lib/companyLogoUrl";

const PROD = "uahdliiwhvviinujtyjj";
const pomeloSite = officialWebsiteUrl("https://pomelocare.com");
const notionSite = officialWebsiteUrl("https://www.notion.so");
const pomeloLogo = chooseDisplayedLogo([], pomeloSite);
const notionLogo = chooseDisplayedLogo([], notionSite);
if (!pomeloSite || !pomeloLogo || !notionLogo) throw new Error("missing logo");

async function applyRepair() {
const env: Record<string, string> = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 1 || line.startsWith("#")) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
if (!String(env.DATABASE_URL || "").includes(PROD)) throw new Error("REFUSED");
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const pooler = new URL(env.DATABASE_URL);
pooler.hostname = "aws-1-eu-west-1.pooler.supabase.com";
pooler.port = "5432";
pooler.username = `postgres.${PROD}`;
pooler.pathname = "/postgres";
pooler.search = "";
const client = new Client({ connectionString: pooler.toString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  const pomelo = await client.query(
    `update public.companies
     set website = $1, logo_url = $2
     where name = 'pomelo-care' and website is null and coalesce(logo_url, '') = ''
     returning id`,
    [pomeloSite, pomeloLogo],
  );
  const notion = await client.query(
    `update public.companies
     set logo_url = $1
     where name = 'Notion' and logo_url like '%custom-agents-og.png%'
     returning id`,
    [notionLogo],
  );
  const jobs = notion.rows[0]
    ? await client.query(
        `update public.jobs
         set logo_url = $1
         where company_id = $2 and logo_url like '%custom-agents-og.png%'
         returning id`,
        [notionLogo, notion.rows[0].id],
      )
    : { rowCount: 0 };
  if (pomelo.rowCount !== 1 || notion.rowCount !== 1 || jobs.rowCount !== 2) {
    throw new Error(`refused counts pomelo=${pomelo.rowCount} notion=${notion.rowCount} jobs=${jobs.rowCount}`);
  }
  await client.query("commit");
  console.log("updated pomelo=1 notion=1 jobs=2");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
}

if (process.env.APPLY_LOGO_REPAIR !== "1") {
  console.log("dry-run pomelo", pomeloSite);
  console.log("dry-run notion logo only");
  console.log("no database write");
} else {
  applyRepair().catch((error) => {
    console.error(error instanceof Error ? error.message : "repair failed");
    process.exitCode = 1;
  });
}
