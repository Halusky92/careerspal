import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

type CsvRow = Record<string, string>;

const parseCsv = (content: string) => {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      current.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      if (next === "\n") {
        continue;
      }
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
};

const toRowObjects = (rows: string[][]): CsvRow[] => {
  if (rows.length === 0) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((cells) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] || "").trim();
    });
    return row;
  });
};

const toStatus = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "published") return "published";
  if (normalized === "draft") return "draft";
  return "draft";
};

const parseDate = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatPostedText = (date: Date | null, status: string) => {
  if (status !== "published") return "Draft";
  if (!date) return "Just now";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const normalizeApplyUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "#";
  if (trimmed === "#" || trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
  if (trimmed.includes("@") && !trimmed.includes(":")) return `mailto:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return trimmed;
};

const normalizeHttpUrl = (value?: string | null) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return trimmed;
};

const inferCategory = (title: string) => {
  const lower = title.toLowerCase();
  if (lower.includes("marketing")) return "Marketing & Growth Ops";
  if (lower.includes("product")) return "Product Management";
  if (lower.includes("customer success")) return "Customer Success Ops";
  if (lower.includes("finance") || lower.includes("billing") || lower.includes("payments")) return "Finance & Admin";
  if (lower.includes("legal") || lower.includes("chief of staff") || lower.includes("executive")) return "Executive & Staff";
  if (lower.includes("automation") || lower.includes("workflow")) return "Automation";
  if (lower.includes("systems")) return "Systems Design";
  return "Operations";
};

const extractTools = (text: string) => {
  const normalized = text.toLowerCase();
  const tools: string[] = [];
  const pushIf = (needle: string, label: string) => {
    if (normalized.includes(needle)) tools.push(label);
  };
  pushIf("notion", "Notion");
  pushIf("zapier", "Zapier");
  pushIf("make.com", "Make.com");
  pushIf("airtable", "Airtable");
  pushIf("slack", "Slack");
  pushIf("salesforce", "Salesforce");
  pushIf("hubspot", "HubSpot");
  pushIf("gainsight", "Gainsight");
  return Array.from(new Set(tools));
};

const extractTags = (title: string, category: string) => {
  const tags = new Set<string>();
  tags.add(category);
  const lower = title.toLowerCase();
  if (lower.includes("revenue")) tags.add("Revenue Ops");
  if (lower.includes("sales")) tags.add("Sales Ops");
  if (lower.includes("marketing")) tags.add("Marketing Ops");
  if (lower.includes("product")) tags.add("Product Ops");
  if (lower.includes("operations")) tags.add("Operations");
  if (lower.includes("legal")) tags.add("Legal Ops");
  if (lower.includes("finance")) tags.add("Finance Ops");
  return Array.from(tags);
};

const parseSalaryRange = (salary: string) => {
  const normalized = salary.toLowerCase().replace(/,/g, "");
  if (!normalized) return { min: null, max: null, currency: "USD" };
  const currency = normalized.includes("€")
    ? "EUR"
    : normalized.includes("cad")
      ? "CAD"
      : normalized.includes("£")
        ? "GBP"
        : "USD";
  const isHourly = normalized.includes("/hr") || normalized.includes("per hour") || normalized.includes("hour");
  const isMonthly = normalized.includes("/ month") || normalized.includes("per month");
  const matches = [...normalized.matchAll(/\$?\s?(\d+(?:\.\d+)?)(k)?/g)];
  const values = matches
    .map((match) => {
      const raw = parseFloat(match[1]);
      if (Number.isNaN(raw)) return null;
      const isThousands = Boolean(match[2]) || normalized.includes("k");
      return isThousands ? raw * 1000 : raw;
    })
    .filter((value): value is number => value !== null);
  if (values.length === 0) return { min: null, max: null, currency };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (isHourly) {
    min *= 2080;
    max *= 2080;
  }
  if (isMonthly) {
    min *= 12;
    max *= 12;
  }
  return { min, max, currency };
};

const buildDescription = (short: string, why: string, detail: string) => {
  const parts = [short, why, detail].map((value) => value.trim()).filter(Boolean);
  return parts.join("\n\n");
};

const getOwnerProfileId = async () => {
  const ownerEmail = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const { data: profiles } = await supabase.from("profiles").select("id,email,role").limit(200);
  if (!profiles || profiles.length === 0) return null;
  if (ownerEmail) {
    const found = profiles.find((profile) => profile.email?.toLowerCase() === ownerEmail);
    if (found?.id) return found.id;
  }
  const admin = profiles.find((profile) => profile.role === "admin");
  if (admin?.id) return admin.id;
  const employer = profiles.find((profile) => profile.role === "employer");
  if (employer?.id) return employer.id;
  return profiles[0]?.id ?? null;
};

const run = async () => {
  const csvPath =
    process.argv[2] ||
    process.env.CSV_PATH ||
    path.resolve(process.cwd(), "..", "Import+1.csv");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows = toRowObjects(parseCsv(raw)).filter((row) => row.Title);
  if (rows.length === 0) {
    console.log("No rows found in CSV.");
    return;
  }

  const ownerId = await getOwnerProfileId();
  if (!ownerId) {
    throw new Error("No owner profile found. Set OWNER_EMAIL or seed profiles first.");
  }

  const companies = rows.map((row) => row.Company?.trim()).filter(Boolean);
  const uniqueCompanies = Array.from(new Set(companies));

  const { data: companyRows } = await supabase
    .from("companies")
    .upsert(
      uniqueCompanies.map((name) => ({
        name,
        website: null,
        created_by: ownerId,
      })),
      { onConflict: "name" },
    )
    .select("id,name");

  const companyMap = new Map((companyRows || []).map((row) => [row.name, row.id]));

  const jobRows = rows.map((row) => {
    const status = toStatus(row.Status || "");
    const publishDate = parseDate(row["Publish Date"] || "") || parseDate(row["Created Date"] || "");
    const postedAt = formatPostedText(publishDate, status);
    const salary = row.Salary || "";
    const salaryRange = parseSalaryRange(salary);
    const title = row.Title.trim();
    const company = row.Company.trim();
    const applyUrl = normalizeApplyUrl(row["Apply Link"] || "");
    const description = buildDescription(row["Short Description"] || "", row["Why This Role"] || "", row["Job Detail"] || "");
    const category = inferCategory(title);
    const tagSource = `${title} ${description}`;
    const tools = extractTools(tagSource);
    const tags = extractTags(title, category);

    return {
      id: row.ID,
      title,
      description: description || "Details available upon request.",
      location: row.Location || "Remote",
      remote_policy: row["Work Mode"] || row.Location || "Remote",
      type: (row["Employment Type"] as string) || "Full-time",
      salary,
      salary_min: salaryRange.min,
      salary_max: salaryRange.max,
      salary_currency: salaryRange.currency,
      posted_at_text: postedAt,
      timestamp: publishDate ? publishDate.getTime() : null,
      category,
      apply_url: applyUrl,
      company_description: null,
      company_website: normalizeHttpUrl(applyUrl),
      logo_url: null,
      tags,
      tools,
      benefits: [],
      keywords: title,
      match_score: null,
      is_featured: false,
      status,
      plan_type: "Standard",
      plan_price: 79,
      plan_currency: "USD",
      views: 0,
      matches: 0,
      created_by: ownerId,
      company_id: companyMap.get(company) || null,
      published_at: status === "published" ? new Date().toISOString() : null,
    };
  });

  const { error } = await supabase.from("jobs").upsert(jobRows, { onConflict: "id" });
  if (error) {
    throw error;
  }

  console.log(`Imported ${jobRows.length} jobs into Supabase.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
