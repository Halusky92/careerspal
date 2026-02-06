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

type SeedUser = {
  email: string;
  password: string;
  role: "admin" | "employer" | "candidate";
  fullName: string;
};

const seedUsers: SeedUser[] = [
  { email: "admin@careerspal.com", password: "AdminPass123!", role: "admin", fullName: "Admin User" },
  { email: "employer@careerspal.com", password: "EmployerPass123!", role: "employer", fullName: "Employer User" },
  { email: "candidate@careerspal.com", password: "CandidatePass123!", role: "candidate", fullName: "Candidate User" },
];

const companies = [
  {
    name: "OpsNova",
    website: "https://opsnova.io",
    description: "Automation-first operations team.",
    long_description: "OpsNova builds modern ops systems for high-growth teams.",
    location: "Remote",
    employee_count: "11-50",
    verified: true,
  },
  {
    name: "NotionWave",
    website: "https://notionwave.com",
    description: "Notion consultancies for operators.",
    long_description: "We help teams build clarity and scale in Notion.",
    location: "Berlin, DE",
    employee_count: "1-10",
    verified: true,
  },
  {
    name: "Flowstack",
    website: "https://flowstack.io",
    description: "Workflow automation for operations.",
    long_description: "Flowstack connects tools and teams into one system.",
    location: "New York, US",
    employee_count: "51-200",
    verified: false,
  },
];

const jobs = [
  {
    title: "Head of Ops",
    description: "Own the operating system for a fast-growing startup.",
    location: "Remote",
    remote_policy: "Remote",
    type: "Full-time",
    salary: "$130k-$160k",
    posted_at_text: "Just now",
    timestamp: Date.now(),
    category: "Operations",
    apply_url: "https://opsnova.io/apply",
    tags: ["Notion", "Automation", "Leadership"],
    tools: ["Notion", "Zapier", "Slack"],
    benefits: ["401k", "Remote stipend", "Health coverage"],
    match_score: 92,
    is_featured: true,
    status: "published",
    plan_type: "Elite Managed",
    plan_price: 299,
    plan_currency: "USD",
    views: 120,
    matches: 26,
  },
  {
    title: "Notion Systems Lead",
    description: "Design and deliver Notion workspaces for enterprise teams.",
    location: "Berlin, DE",
    remote_policy: "Hybrid",
    type: "Contract",
    salary: "$90k-$120k",
    posted_at_text: "2 days ago",
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
    category: "Operations",
    apply_url: "mailto:talent@notionwave.com",
    tags: ["Notion", "Documentation", "Ops"],
    tools: ["Notion", "Figma"],
    benefits: ["Flexible schedule"],
    match_score: 86,
    is_featured: false,
    status: "published",
    plan_type: "Featured Pro",
    plan_price: 149,
    plan_currency: "USD",
    views: 78,
    matches: 14,
  },
  {
    title: "Automation Engineer",
    description: "Build automation pipelines across sales and ops.",
    location: "New York, US",
    remote_policy: "Onsite",
    type: "Full-time",
    salary: "$110k-$135k",
    posted_at_text: "5 days ago",
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 5,
    category: "Operations",
    apply_url: "https://flowstack.io/careers",
    tags: ["Automation", "Zapier", "Make"],
    tools: ["Zapier", "Make.com", "Airtable"],
    benefits: ["Health coverage", "Learning stipend"],
    match_score: 80,
    is_featured: false,
    status: "published",
    plan_type: "Standard",
    plan_price: 79,
    plan_currency: "USD",
    views: 42,
    matches: 6,
  },
];

const upsertProfile = async (user: SeedUser) => {
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === user.email.toLowerCase());

  const created =
    found ||
    (
      await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      })
    ).data.user;

  if (!created) return null;

  await supabase.from("profiles").upsert(
    {
      id: created.id,
      email: user.email,
      role: user.role,
      full_name: user.fullName,
      is_onboarded: true,
    },
    { onConflict: "id" },
  );

  return created;
};

const run = async () => {
  const adminUser = await upsertProfile(seedUsers[0]);
  const employerUser = await upsertProfile(seedUsers[1]);

  const ownerId = employerUser?.id || adminUser?.id;
  if (!ownerId) {
    throw new Error("Failed to create seed users.");
  }

  const { data: companyRows } = await supabase
    .from("companies")
    .upsert(
      companies.map((company) => ({
        ...company,
        created_by: ownerId,
      })),
      { onConflict: "name" },
    )
    .select("id,name");

  const companyMap = new Map((companyRows || []).map((row) => [row.name, row.id]));

  const jobRows = jobs.map((job, index) => ({
    ...job,
    company_id: companyMap.get(companies[index % companies.length].name) || null,
    created_by: ownerId,
    published_at: job.status === "published" ? new Date().toISOString() : null,
  }));

  await supabase.from("jobs").upsert(jobRows, { onConflict: "id" });

  console.log("Supabase seed complete.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
