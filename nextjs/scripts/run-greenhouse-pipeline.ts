import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const secret = (process.env.SOURCING_CRON_SECRET || process.env.CRON_SECRET || "").trim();
const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.CAREERSPAL_SITE_URL || "https://www.careerspal.com")
  .trim()
  .replace(/\/+$/, "");

async function main() {
  if (!secret) throw new Error("Missing SOURCING_CRON_SECRET.");
  const path = process.env.SOURCING_PIPELINE_PATH || "/api/cron/sourcing/pipeline/greenhouse";
  const url = `${base}${path}?secret=${encodeURIComponent(secret)}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  console.log(res.status);
  console.log(text.slice(0, 8000));
  if (!res.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
